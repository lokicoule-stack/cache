import { TransportMiddleware } from '../base-middleware'

import { type RetryConfig, DEFAULT_RETRY_CONFIG } from './retry.config'

import type { RetryQueue } from './queue/retry-queue'
import type { Transport } from '@/contracts/transport'
import type { TransportData } from '@/types'

/**
 * Retry middleware - automatically retries failed publishes using a queue
 */
export class RetryMiddleware extends TransportMiddleware {
  #retryQueue?: RetryQueue
  #config: Required<RetryConfig>

  constructor(transport: Transport, retryQueue?: RetryQueue, config: RetryConfig = {}) {
    super(transport)
    this.#retryQueue = retryQueue
    this.#config = { ...DEFAULT_RETRY_CONFIG, ...config }
  }

  override async publish(channel: string, data: TransportData): Promise<void> {
    try {
      await this.transport.publish(channel, data)
    } catch (error) {
      if (this.#config.enabled && this.#retryQueue) {
        await this.#retryQueue.enqueue(channel, data, error as Error)
      } else {
        throw error
      }
    }
  }
}
