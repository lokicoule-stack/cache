/**
 * Deduplication contract and implementations
 *
 * Provides a unified interface for request deduplication strategies:
 * - Inflight: Deduplicates concurrent requests only
 * - SWR: Deduplicates with stale-while-revalidate caching
 */

// ============================================================================
// Public API
// ============================================================================

export type DeduplicationOptions = SWRConfig

export interface SWRConfig {
  /**
   * Time in ms before cached data becomes stale
   */
  staleTime: number

  /**
   * Called after successful revalidation
   */
  onRevalidate?: (key: string, value: unknown) => void

  /**
   * Called on revalidation error
   */
  onError?: (key: string, error: Error) => void

  /**
   * Minimum time between revalidations to prevent request stampede
   * @default 2000
   */
  revalidateWindow?: number
}

export interface Deduplicator {
  /**
   * Get a value with deduplication
   * 
   * @param key - Unique cache key
   * @param fn - Function to fetch fresh data
   * @param options - Deduplication configuration
   * @throws Error on cache miss if fetch fails
   */
  get<T>(key: string, fn: () => Promise<T>, options?: DeduplicationOptions): Promise<T>

  /**
   * Remove cached data for a specific key
   */
  invalidate(key: string): void

  /**
   * Clear all cached data
   */
  invalidateAll(): void
}

// ============================================================================
// Orchestrator
// ============================================================================

/**
 * Creates a deduplicator that automatically chooses the right strategy:
 * - If staleTime is provided: Uses SWR (stale-while-revalidate)
 * - Otherwise: Uses inflight deduplication only
 */
export function createDeduplicator(): Deduplicator {
  const inflightDedup = createInflightDeduplicator()
  const swrDedup = createSWRDeduplicator()

  return {
    get: <T>(key: string, fn: () => Promise<T>, options?: DeduplicationOptions): Promise<T> => {
      const shouldUseSWR = options?.staleTime !== undefined

      if (shouldUseSWR) {
        return swrDedup.get(key, fn, options)
      }

      return inflightDedup.get(key, fn, options)
    },

    invalidate: (key: string): void => {
      inflightDedup.invalidate(key)
      swrDedup.invalidate(key)
    },

    invalidateAll: (): void => {
      inflightDedup.invalidateAll()
      swrDedup.invalidateAll()
    },
  }
}

// ============================================================================
// Inflight Strategy
// ============================================================================

/**
 * Deduplicates only concurrent requests.
 * Once a request completes, the next call will execute the function again.
 */
function createInflightDeduplicator(): Deduplicator {
  const pendingRequests = new Map<string, Promise<unknown>>()

  return {
    get: async <T>(key: string, fn: () => Promise<T>): Promise<T> => {
      const existingRequest = pendingRequests.get(key)
      
      if (existingRequest) {
        return existingRequest as Promise<T>
      }

      const newRequest = fn()
        .then(result => {
          pendingRequests.delete(key)
          return result
        })
        .catch(error => {
          pendingRequests.delete(key)
          throw error
        })

      pendingRequests.set(key, newRequest)
      
      return newRequest
    },

    invalidate: (key: string): void => {
      pendingRequests.delete(key)
    },

    invalidateAll: (): void => {
      pendingRequests.clear()
    },
  }
}

// ============================================================================
// SWR Strategy
// ============================================================================

const DEFAULT_REVALIDATE_WINDOW = 2000

interface CachedValue<T> {
  data: T
  cachedAt: number
}

/**
 * Stale-While-Revalidate: returns cached data immediately,
 * revalidates in background if stale.
 */
function createSWRDeduplicator(): Deduplicator {
  const cache = new Map<string, CachedValue<unknown>>()
  const pendingRevalidations = new Map<string, Promise<unknown>>()
  const lastRevalidationTime = new Map<string, number>()

  const isCacheStale = (entry: CachedValue<unknown>, staleTime: number): boolean => {
    const age = Date.now() - entry.cachedAt
    return age > staleTime
  }

  const shouldStartRevalidation = (key: string, revalidateWindow: number): boolean => {
    if (pendingRevalidations.has(key)) {
      return false
    }

    const lastRevalidatedAt = lastRevalidationTime.get(key)
    
    if (!lastRevalidatedAt) {
      return true
    }

    const timeSinceLastRevalidation = Date.now() - lastRevalidatedAt
    return timeSinceLastRevalidation >= revalidateWindow
  }

  const startBackgroundRevalidation = <T>(
    key: string,
    fetchFn: () => Promise<T>,
    config: SWRConfig,
  ): void => {
    const revalidateWindow = config.revalidateWindow ?? DEFAULT_REVALIDATE_WINDOW

    if (!shouldStartRevalidation(key, revalidateWindow)) {
      return
    }

    const revalidationStartedAt = Date.now()
    lastRevalidationTime.set(key, revalidationStartedAt)

    const revalidationPromise = fetchFn()
      .then(freshData => {
        const completedAt = Date.now()
        
        cache.set(key, { 
          data: freshData, 
          cachedAt: completedAt, 
        })
        
        lastRevalidationTime.set(key, completedAt)
        
        config.onRevalidate?.(key, freshData)
        
        return freshData
      })
      .catch((error: Error) => {
        lastRevalidationTime.delete(key)
        config.onError?.(key, error)
        throw error
      })
      .finally(() => {
        pendingRevalidations.delete(key)
      })

    pendingRevalidations.set(key, revalidationPromise)

    suppressUnhandledRejection(revalidationPromise)
  }
  
  /**
  * Suppresses unhandled promise rejection warnings for background tasks.
  * Errors are already handled via onError callback.
  */
  const suppressUnhandledRejection = (promise: Promise<unknown>): void => {
    void promise.catch(() => {})
  }

  const fetchWithDeduplication = <T>(
    key: string,
    fetchFn: () => Promise<T>,
    config: DeduplicationOptions,
  ): Promise<T> => {
    let fetchPromise = pendingRevalidations.get(key) as Promise<T> | undefined

    if (!fetchPromise) {
      fetchPromise = fetchFn()
        .then(freshData => {
          cache.set(key, { 
            data: freshData, 
            cachedAt: Date.now(), 
          })
          return freshData
        })
        .catch((error: Error) => {
          config.onError?.(key, error)
          throw error
        })
        .finally(() => {
          pendingRevalidations.delete(key)
        })

      pendingRevalidations.set(key, fetchPromise)
    }

    return fetchPromise
  }

  return {
    get: async <T>(
      key: string,
      fetchFn: () => Promise<T>,
      options: DeduplicationOptions,
    ): Promise<T> => {
      const cachedEntry = cache.get(key) as CachedValue<T> | undefined

      if (cachedEntry) {
        const isStale = isCacheStale(cachedEntry, options.staleTime)

        if (isStale) {
          startBackgroundRevalidation(key, fetchFn, options)
        }

        return cachedEntry.data
      }

      return fetchWithDeduplication(key, fetchFn, options)
    },

    invalidate: (key: string): void => {
      cache.delete(key)
      pendingRevalidations.delete(key)
      lastRevalidationTime.delete(key)
    },

    invalidateAll: (): void => {
      cache.clear()
      pendingRevalidations.clear()
      lastRevalidationTime.clear()
    },
  }
}