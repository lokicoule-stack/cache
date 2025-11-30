import type { Message } from './message'

/**
 * Retry queue configuration
 *
 * @example
 * ```ts
 * const bus = createBus<Messages>({
 *   transport: redis(),
 *   channel: 'app',
 *   instanceId: 'server-1',
 *   retryQueue: {
 *     maxAttempts: 5,
 *     retryInterval: 2000,
 *     onDeadLetter: (msg, err) => {
 *       logger.error('Failed after retries', { msg, err })
 *     }
 *   }
 * })
 * ```
 */
export interface RetryQueueOptions {
  /**
   * Enable retry queue
   * @default true
   */
  enabled?: boolean

  /**
   * Retry interval in milliseconds
   * @default 1000
   */
  retryInterval?: number

  /**
   * Max attempts before dead letter
   * @default 3
   */
  maxAttempts?: number

  /**
   * Remove duplicate messages from queue
   * @default true
   */
  removeDuplicates?: boolean

  /**
   * Max queue size
   * @default 1000
   */
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

export class RetryQueue {
  #queue = new Map<string, RetryEntry>()
  #timer?: NodeJS.Timeout | undefined
  #running = false
  #retryHandler?: (data: Uint8Array) => Promise<void>
  readonly #options: Required<RetryQueueOptions>

  constructor(options: RetryQueueOptions = {}) {
    const noop = () => {}

    this.#options = {
      enabled: options.enabled ?? true,
      retryInterval: options.retryInterval ?? 1000,
      maxAttempts: options.maxAttempts ?? 3,
      removeDuplicates: options.removeDuplicates ?? true,
      maxSize: options.maxSize ?? 1000,
      onDeadLetter: options.onDeadLetter ?? noop,
      onRetry: options.onRetry ?? noop,
    }
  }

  setRetryHandler(handler: (data: Uint8Array) => Promise<void>): void {
    this.#retryHandler = handler
  }

  start(): void {
    if (this.#running || !this.#options.enabled) {return}

    this.#running = true
    this.#processQueue()
  }

  stop(): void {
    this.#running = false
    if (this.#timer) {
      clearTimeout(this.#timer)
      this.#timer = undefined
    }
  }

  async add(message: Message, data: Uint8Array, error: Error, attempt = 0): Promise<void> {
    if (!this.#options.enabled) {
      return
    }

    if (attempt >= this.#options.maxAttempts) {
      await this.#options.onDeadLetter(message, error, attempt)
      return
    }

    if (this.#queue.size >= this.#options.maxSize) {
      return
    }

    if (this.#options.removeDuplicates && this.#queue.has(message.id)) {
      return
    }

    const nextRetryAt = Date.now() + this.#options.retryInterval

    this.#queue.set(message.id, {
      message,
      data,
      attempt: attempt + 1,
      nextRetryAt,
      error,
    })
  }

  async #processQueue(): Promise<void> {
    if (!this.#running) {
      return
    }

    const now = Date.now()
    const toRetry: RetryEntry[] = []

    for (const [id, entry] of this.#queue.entries()) {
      if (entry.nextRetryAt <= now) {
        toRetry.push(entry)
        this.#queue.delete(id)
      }
    }

    await Promise.allSettled(toRetry.map((entry) => this.#retry(entry)))

    this.#timer = setTimeout(() => void this.#processQueue(), 100)
  }

  async #retry(entry: RetryEntry): Promise<void> {
    try {
      await this.#options.onRetry(entry.message, entry.attempt)

      if (this.#retryHandler) {
        await this.#retryHandler(entry.data)
      }
    } catch (error) {
      await this.add(entry.message, entry.data, error as Error, entry.attempt)
    }
  }
}
