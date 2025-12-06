import { TransportMiddleware } from '../base'

import { RetryQueue } from './queue/retry-queue'
import {
  type RetryConfig,
  type RetryConfigObject,
  DEFAULT_RETRY_CONFIG,
} from './retry-config'

import type { Transport } from '@/contracts/transport'
import type { TransportData } from '@/types'

/** @internal */
export class RetryMiddleware extends TransportMiddleware {
  readonly #retryQueue: RetryQueue | null

  constructor(transport: Transport, config?: RetryConfig) {
    super(transport)

    const normalizedConfig = this.#normalizeConfig(config)

    this.#retryQueue = this.#initializeQueue(normalizedConfig)
  }

  public override async connect(): Promise<void> {
    await this.transport.connect()

    if (this.#retryQueue) {
      await this.#retryQueue.start()
    }
  }

  public override async disconnect(): Promise<void> {
    if (this.#retryQueue) {
      await this.#retryQueue.stop()
    }

    await this.transport.disconnect()
  }

  public override async publish(
    channel: string,
    data: TransportData
  ): Promise<void> {
    try {
      await this.transport.publish(channel, data)
    } catch (error) {
      if (!this.#retryQueue) {
        throw error
      }

      await this.#retryQueue.enqueue(
        channel,
        data,
        error instanceof Error ? error : new Error(String(error))
      )
    }
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

  #initializeQueue(config: RetryConfigObject): RetryQueue | null {
    if (config.maxAttempts === 0) {
      return null
    }

    const queueConfig = config.queue ?? DEFAULT_RETRY_CONFIG.queue

    return new RetryQueue(this.transport, {
      baseDelayMs: config.delay,
      intervalMs: 5000, // Fixed processing interval
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