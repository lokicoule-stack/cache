export type DedupFn = <T>(key: string, fn: () => Promise<T>) => Promise<T>

/**
 * @internal
 */
export function createDedup(): DedupFn {
  const pending = new Map<string, Promise<unknown>>()

  return <T>(key: string, fn: () => Promise<T>): Promise<T> => {
    const existing = pending.get(key)

    if (existing) {
      return existing as Promise<T>
    }

    const promise = fn().finally(() => pending.delete(key))

    pending.set(key, promise)

    return promise
  }
}
