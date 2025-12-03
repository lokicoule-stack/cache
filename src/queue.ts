import { createHash, randomUUID } from 'node:crypto'

import type { ITransport, TransportData } from './types'

export interface QueuedMessage {
  id: string
  channel: string
  data: TransportData
  attempts: number
  nextRetryAt: Date
  createdAt: Date
  error?: string
}

export interface QueueProcessorOptions {
  baseDelayMs?: number
  intervalMs?: number
  maxAttempts?: number
  backoff?: 'exponential' | 'fixed'
  removeDuplicates?: boolean
  maxSize?: number
  onDeadLetter?: (
    channel: string,
    data: TransportData,
    error: Error,
    attempts: number,
  ) => void | Promise<void>
  onRetry?: (channel: string, data: TransportData, attempt: number) => void | Promise<void>
}

/**
 * Queue processor for retry logic
 */
export class QueueProcessor {
  #queue = new Map<string, QueuedMessage>()
  #transport: ITransport
  #options: Required<Omit<QueueProcessorOptions, 'onDeadLetter' | 'onRetry'>> & {
    onDeadLetter?: QueueProcessorOptions['onDeadLetter']
    onRetry?: QueueProcessorOptions['onRetry']
  }
  #timer?: NodeJS.Timeout
  #isRunning = false

  constructor(transport: ITransport, options: QueueProcessorOptions = {}) {
    this.#transport = transport
    this.#options = {
      baseDelayMs: options.baseDelayMs ?? 60000,
      intervalMs: options.intervalMs ?? 5000,
      maxAttempts: options.maxAttempts ?? 10,
      backoff: options.backoff ?? 'exponential',
      removeDuplicates: options.removeDuplicates ?? true,
      maxSize: options.maxSize ?? 1000,
      onDeadLetter: options.onDeadLetter,
      onRetry: options.onRetry,
    }
  }

  async start(): Promise<void> {
    if (this.#isRunning) {
      return
    }
    this.#isRunning = true
    this.#schedule()
  }

  async stop(): Promise<void> {
    this.#isRunning = false
    if (this.#timer) {
      clearTimeout(this.#timer)
      this.#timer = undefined
    }
  }

  async enqueue(channel: string, data: TransportData, error?: Error): Promise<string | undefined> {
    if (this.#queue.size >= this.#options.maxSize) {
      return undefined
    }

    const id = this.#options.removeDuplicates ? this.#hash(channel, data) : randomUUID()

    if (this.#options.removeDuplicates && this.#queue.has(id)) {
      return undefined
    }

    this.#queue.set(id, {
      id,
      channel,
      data,
      attempts: 0,
      nextRetryAt: new Date(Date.now() + this.#options.baseDelayMs),
      createdAt: new Date(),
      error: error?.message,
    })

    return id
  }

  #hash(channel: string, data: TransportData): string {
    return createHash('sha256').update(channel).update(data).digest('hex')
  }

  #schedule(): void {
    this.#timer = setTimeout(async () => {
      if (!this.#isRunning) {
        return
      }

      await this.#process()
      this.#schedule()
    }, this.#options.intervalMs)
  }

  async #process(): Promise<void> {
    const now = new Date()
    const ready = Array.from(this.#queue.values()).filter((msg) => msg.nextRetryAt <= now)

    await Promise.allSettled(ready.map((msg) => this.#processMessage(msg)))
  }

  async #processMessage(msg: QueuedMessage): Promise<void> {
    msg.attempts++

    if (this.#options.onRetry) {
      try {
        await this.#options.onRetry(msg.channel, msg.data, msg.attempts)
      } catch {
        /* empty */
      }
    }

    try {
      await this.#transport.publish(msg.channel, msg.data)
      this.#queue.delete(msg.id)
    } catch (error) {
      msg.error = (error as Error).message

      if (msg.attempts >= this.#options.maxAttempts) {
        if (this.#options.onDeadLetter) {
          try {
            await this.#options.onDeadLetter(msg.channel, msg.data, error as Error, msg.attempts)
          } catch {
            /* empty */
          }
        }

        this.#queue.delete(msg.id)
      } else {
        let delayMs: number
        if (this.#options.backoff === 'exponential') {
          delayMs = this.#options.baseDelayMs * Math.pow(2, msg.attempts - 1)
        } else {
          delayMs = this.#options.baseDelayMs
        }

        msg.nextRetryAt = new Date(Date.now() + delayMs)
      }
    }
  }

  getStats(): {
    pending: number
    total: number
    messages: ReadonlyArray<{
      id: string
      channel: string
      attempts: number
      nextRetryAt: Date
      error?: string
    }>
  } {
    const messages = Array.from(this.#queue.values())

    return {
      pending: messages.length,
      total: messages.length,
      messages: messages.map((msg) => ({
        id: msg.id,
        channel: msg.channel,
        attempts: msg.attempts,
        nextRetryAt: msg.nextRetryAt,
        error: msg.error,
      })),
    }
  }

  clear(): void {
    this.#queue.clear()
  }

  get size(): number {
    return this.#queue.size
  }
}
