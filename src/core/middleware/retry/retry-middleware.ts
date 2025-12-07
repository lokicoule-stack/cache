import { TransportMiddleware } from '../base'

import { RetryQueue } from './queue/retry-queue'
import { type RetryConfig, type RetryConfigObject, DEFAULT_RETRY_CONFIG } from './retry-config'

import type { Transport } from '@/contracts/transport'
import type { TransportData } from '@/types'

import { TransportError } from '@/infrastructure/transports/transport-errors'

/**
 * Middleware that adds automatic retry capabilities to transports.
 *
 * @internal
 */
export class RetryMiddleware extends TransportMiddleware {
  readonly #queue: RetryQueue | null

  constructor(transport: Transport, config?: RetryConfig) {
    super(transport)

    const normalizedConfig = this.#normalizeConfig(config)

    this.#queue =
      (normalizedConfig.maxAttempts ?? 0) > 0 ? this.#createQueue(normalizedConfig) : null
  }

  override async connect(): Promise<void> {
    this.#setupReconnectHandler()
    await this.transport.connect()
    await this.#queue?.start()
  }

  override async disconnect(): Promise<void> {
    await this.#queue?.stop()
    await this.transport.disconnect()
  }

  override async publish(channel: string, data: TransportData): Promise<void> {
    try {
      await this.transport.publish(channel, data)
    } catch (err) {
      const queue = this.#queue

      if (this.#shouldRetry(err) && queue) {
        const error = err instanceof Error ? err : new Error(String(err))

        await queue.enqueue(channel, data, error)

        return
      }
      throw err
    }
  }

  #shouldRetry(err: unknown): boolean {
    if (!this.#queue) {
      return false
    }

    if (err instanceof TransportError && err.context?.retryable !== undefined) {
      return err.context.retryable
    }

    return true
  }

  #setupReconnectHandler(): void {
    if (!this.#queue) {
      return
    }

    this.transport.onReconnect(() => {
      if (this.#queue) {
        void this.#queue.flush()
      }
    })
  }

  #normalizeConfig(config?: RetryConfig): RetryConfigObject {
    if (config === false) {
      return { ...DEFAULT_RETRY_CONFIG, maxAttempts: 0 }
    }

    if (config === undefined || config === true) {
      return DEFAULT_RETRY_CONFIG
    }

    if (typeof config === 'number') {
      return { ...DEFAULT_RETRY_CONFIG, maxAttempts: config }
    }

    return {
      ...DEFAULT_RETRY_CONFIG,
      ...config,
      queue: {
        ...DEFAULT_RETRY_CONFIG.queue,
        ...config.queue,
      },
    }
  }

  #createQueue(config: RetryConfigObject): RetryQueue {
    const queueConfig = config.queue ?? DEFAULT_RETRY_CONFIG.queue

    return new RetryQueue(this.transport, {
      baseDelayMs: config.delay,
      intervalMs: queueConfig.intervalMs,
      maxAttempts: config.maxAttempts,
      backoff: config.backoff,
      maxSize: queueConfig.maxSize,
      concurrency: queueConfig.concurrency,
      removeDuplicates: queueConfig.removeDuplicates,
      onRetry: config.onRetry,
      onDeadLetter: config.onDeadLetter,
    })
  }
}
