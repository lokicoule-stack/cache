
import { TransportMiddleware } from './base'

import type { QueueProcessor } from '../queue'
import type { ITransport, TransportData } from '../types'

/**
 * Retry middleware
 */
export class RetryMiddleware extends TransportMiddleware {
  #queueProcessor?: QueueProcessor

  constructor(transport: ITransport, queueProcessor?: QueueProcessor) {
    super(transport)
    this.#queueProcessor = queueProcessor
  }

  override async publish(channel: string, data: TransportData): Promise<void> {
    try {
      await this.transport.publish(channel, data)
    } catch (error) {
      if (this.#queueProcessor) {
        await this.#queueProcessor.enqueue(channel, data, error as Error)
      } else {
        throw error
      }
    }
  }
}
