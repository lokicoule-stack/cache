import { TransportMiddleware } from '../base'

import { type RetryConfig, DEFAULT_RETRY_CONFIG } from './retry.config'

import type { ITransport } from '../../../core/transport'
import type { TransportData } from '../../../core/types'
import type { RetryQueue } from '../../../infrastructure/queue'

/**
 * Retry middleware - automatically retries failed publishes using a queue
 */
export class RetryMiddleware extends TransportMiddleware {
  #retryQueue?: RetryQueue
  #config: Required<RetryConfig>

  constructor(transport: ITransport, retryQueue?: RetryQueue, config: RetryConfig = {}) {
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
