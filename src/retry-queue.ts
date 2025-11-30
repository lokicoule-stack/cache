import type { Message } from './message'

/** Retry queue configuration */
export interface RetryQueueOptions {
  /** Enable retry queue (default: true) */
  enabled?: boolean
  /** Retry interval in ms (default: 1000) */
  retryInterval?: number
  /** Max attempts before dead letter (default: 3) */
  maxAttempts?: number
  /** Remove duplicate messages (default: true) */
  removeDuplicates?: boolean
  /** Max queue size (default: 1000) */
  maxSize?: number

  /** Called when max attempts exceeded */
  onDeadLetter?: (message: Message, error: Error, attempts: number) => void | Promise<void>
  /** Called before each retry */
  onRetry?: (message: Message, attempt: number) => void | Promise<void>
}

interface RetryEntry {
  message: Message
  data: Uint8Array
  attempt: number
  nextRetryAt: number
  error: Error
}

/**
 * Retry queue with fixed interval (inspired by @boringnode/bus)
 *
 * Automatically retries failed publishes with configurable hooks.
 */
export class RetryQueue {
  #queue = new Map<string, RetryEntry>()
  #timer?: NodeJS.Timeout | undefined
  #running = false
  #retryHandler?: (data: Uint8Array) => Promise<void>
  readonly #options: Required<RetryQueueOptions>

  constructor(options: RetryQueueOptions = {}) {
    this.#options = {
      enabled: options.enabled ?? true,
      retryInterval: options.retryInterval ?? 1000,
      maxAttempts: options.maxAttempts ?? 3,
      removeDuplicates: options.removeDuplicates ?? true,
      maxSize: options.maxSize ?? 1000,
      onDeadLetter: options.onDeadLetter ?? (() => { /* noop */ }),
      onRetry: options.onRetry ?? (() => { /* noop */ }),
    }
  }

  /** Set the retry handler (called by Bus) */
  setRetryHandler(handler: (data: Uint8Array) => Promise<void>): void {
    this.#retryHandler = handler
  }

  /** Start processing the queue */
  start(): void {
    if (this.#running || !this.#options.enabled) {return}
    this.#running = true
    void this.#processQueue()
  }

  /** Stop processing the queue (keeps messages for potential resume) */
  stop(): void {
    this.#running = false
    if (this.#timer) {
      clearTimeout(this.#timer)
      this.#timer = undefined
    }
  }

  /** Add message to retry queue */
  async add(message: Message, data: Uint8Array, error: Error, attempt = 0): Promise<void> {
    if (!this.#options.enabled) {return}

    // Max attempts reached → dead letter
    if (attempt >= this.#options.maxAttempts) {
      await this.#deadLetter(message, error, attempt)
      return
    }

    // Queue full -> drop
    if (this.#queue.size >= this.#options.maxSize) {
      console.warn('[RetryQueue] Queue full, dropping message', {
        messageId: message.id,
        queueSize: this.#queue.size,
      })
      return
    }

    // Already in queue -> skip
    if (this.#options.removeDuplicates && this.#queue.has(message.id)) {
      console.debug('[RetryQueue] Duplicate message, skipping', {
        messageId: message.id,
      })
      return
    }

    // Add to queue
    const nextRetryAt = Date.now() + this.#options.retryInterval
    this.#queue.set(message.id, {
      message,
      data,
      attempt: attempt + 1,
      nextRetryAt,
      error,
    })

    console.debug('[RetryQueue] Message added', {
      messageId: message.id,
      attempt: attempt + 1,
      maxAttempts: this.#options.maxAttempts,
      retryInterval: this.#options.retryInterval,
    })
  }

  async #processQueue(): Promise<void> {
    if (!this.#running) {return}

    const now = Date.now()
    const toRetry: RetryEntry[] = []

    // Find messages ready to retry
    for (const [id, entry] of this.#queue.entries()) {
      if (entry.nextRetryAt <= now) {
        toRetry.push(entry)
        this.#queue.delete(id)
      }
    }

    // Process retries
    for (const entry of toRetry) {
      await this.#retry(entry)
    }

    // Check every 100ms
    this.#timer = setTimeout(() => void this.#processQueue(), 100)
  }

  async #retry(entry: RetryEntry): Promise<void> {
    try {
      await this.#options.onRetry(entry.message, entry.attempt)

      console.debug('[RetryQueue] Retrying message', {
        messageId: entry.message.id,
        attempt: entry.attempt,
        maxAttempts: this.#options.maxAttempts,
      })

      if (this.#retryHandler) {
        await this.#retryHandler(entry.data)
      }
    } catch (error) {
      console.error('[RetryQueue] Retry failed', {
        messageId: entry.message.id,
        attempt: entry.attempt,
        error,
      })

      // Try again
      await this.add(entry.message, entry.data, error as Error, entry.attempt)
    }
  }

  async #deadLetter(message: Message, error: Error, attempts: number): Promise<void> {
    console.error('[RetryQueue] Message dead lettered', {
      messageId: message.id,
      attempts,
      error: error.message,
    })

    try {
      await this.#options.onDeadLetter(message, error, attempts)
    } catch (dlqError) {
      console.error('[RetryQueue] Dead letter handler failed', {
        messageId: message.id,
        error: dlqError,
      })
    }
  }
}
