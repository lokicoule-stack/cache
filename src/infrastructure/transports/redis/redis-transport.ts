import { TransportError, TransportErrorCode, TransportOperation } from '../transport-errors'

import { RedisConnectionManager } from './redis-connection-manager'
import {
  type RedisTransportConfig,
  type RedisTransportExternalConfig,
  type RedisInstance,
} from './redis-transport-config'

import type { Transport } from '@/contracts/transport'
import type { TransportData, TransportMessageHandler } from '@/types'

/**
 * Redis transport supporting standalone and cluster modes.
 *
 * @public
 */
export class RedisTransport implements Transport {
  readonly name = 'redis'

  #connectionManager: RedisConnectionManager

  constructor(config: RedisTransportConfig | RedisTransportExternalConfig = {}) {
    this.#connectionManager = new RedisConnectionManager(config)
  }

  async connect(): Promise<void> {
    try {
      await this.#connectionManager.connect()
    } catch (err) {
      throw this.#createError(TransportOperation.CONNECT, TransportErrorCode.CONNECTION_FAILED, err)
    }
  }

  async disconnect(): Promise<void> {
    try {
      await this.#connectionManager.disconnect()
    } catch (err) {
      throw this.#createError(
        TransportOperation.DISCONNECT,
        TransportErrorCode.CONNECTION_FAILED,
        err,
      )
    }
  }

  async publish(channel: string, data: TransportData): Promise<void> {
    const publisher = this.#getReadyClient('publisher', TransportOperation.PUBLISH)

    try {
      const buffer = Buffer.from(data)

      await publisher.publish(channel, buffer)
    } catch (err) {
      throw this.#createError(
        TransportOperation.PUBLISH,
        TransportErrorCode.PUBLISH_FAILED,
        err,
        channel,
      )
    }
  }

  async subscribe(channel: string, handler: TransportMessageHandler): Promise<void> {
    const subscriber = this.#getReadyClient('subscriber', TransportOperation.SUBSCRIBE)

    try {
      await subscriber.subscribe(channel, (msg) => {
        const data = new Uint8Array(Buffer.from(msg))

        void handler(data)
      })
    } catch (err) {
      throw this.#createError(
        TransportOperation.SUBSCRIBE,
        TransportErrorCode.SUBSCRIBE_FAILED,
        err,
        channel,
      )
    }
  }

  async unsubscribe(channel: string): Promise<void> {
    const subscriber = this.#getReadyClient('subscriber', TransportOperation.UNSUBSCRIBE)

    try {
      await subscriber.unsubscribe(channel)
    } catch (err) {
      throw this.#createError(
        TransportOperation.UNSUBSCRIBE,
        TransportErrorCode.UNSUBSCRIBE_FAILED,
        err,
        channel,
      )
    }
  }

  onReconnect(callback: () => void): void {
    this.#connectionManager.onReconnect(callback)
  }

  #getReadyClient(type: 'publisher' | 'subscriber', operation: TransportOperation): RedisInstance {
    const client =
      type === 'publisher' ? this.#connectionManager.publisher : this.#connectionManager.subscriber

    if (!client) {
      throw new TransportError(
        `Transport not connected. Call connect() before ${operation}`,
        TransportErrorCode.NOT_READY,
        { context: { transport: this.name, operation, retryable: false } },
      )
    }

    if (!this.#connectionManager.isReady(client)) {
      throw new TransportError(`Transport temporarily unavailable`, TransportErrorCode.NOT_READY, {
        context: { transport: this.name, operation, retryable: true },
      })
    }

    return client
  }

  #createError(
    operation: TransportOperation,
    code: TransportErrorCode,
    err: unknown,
    channel?: string,
  ): TransportError {
    const error = err as Error
    const channelInfo = channel ? ` on channel '${channel}'` : ''

    return new TransportError(`Failed to ${operation}${channelInfo}: ${error.message}`, code, {
      context: {
        transport: this.name,
        operation,
        retryable: true,
        ...(channel && { channel }),
      },
      cause: error,
    })
  }
}

/**
 * Factory for creating Redis transport instances.
 *
 * @public
 */
export function redis(
  config?: RedisTransportConfig | RedisTransportExternalConfig,
): RedisTransport {
  return new RedisTransport(config)
}
