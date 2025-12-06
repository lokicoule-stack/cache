import { createClient } from 'redis'

import { TransportError, TransportErrorCode } from '../transport-errors'

import type { RedisTransportConfig } from './redis-transport-config'
import type { Transport } from '@/contracts/transport'
import type { TransportData, TransportMessageHandler } from '@/types'

/** @public */
export class RedisTransport implements Transport {
  readonly name = 'redis'

  #publisher?: ReturnType<typeof createClient>
  #subscriber?: ReturnType<typeof createClient>
  #config: RedisTransportConfig
  #subscriptions = new Map<string, Set<TransportMessageHandler>>()

  constructor(config: RedisTransportConfig = {}) {
    this.#config = config
  }

  async connect(): Promise<void> {
    try {
      this.#publisher = createClient(this.#config)
      this.#subscriber = this.#publisher.duplicate()

      await Promise.all([this.#publisher.connect(), this.#subscriber.connect()])
    } catch (error) {
      throw new TransportError(
        `Failed to connect to ${this.name}: ${(error as Error).message}`,
        TransportErrorCode.CONNECTION_FAILED,
        {
          context: { transport: this.name, operation: 'connect', retryable: true },
          cause: error as Error,
        },
      )
    }
  }

  async disconnect(): Promise<void> {
    try {
      await Promise.all([this.#publisher?.quit(), this.#subscriber?.quit()])

      this.#publisher = undefined
      this.#subscriber = undefined
      this.#subscriptions.clear()
    } catch (error) {
      throw new TransportError(
        `Failed to disconnect from ${this.name}: ${(error as Error).message}`,
        TransportErrorCode.CONNECTION_FAILED,
        {
          context: { transport: this.name, operation: 'disconnect', retryable: true },
          cause: error as Error,
        },
      )
    }
  }

  async publish(channel: string, data: TransportData): Promise<void> {
    if (!this.#publisher?.isReady) {
      throw new TransportError(
        `${this.name} transport is not ready for publish`,
        TransportErrorCode.NOT_READY,
        {
          context: { transport: this.name, operation: 'publish', retryable: false },
        },
      )
    }

    try {
      await this.#publisher.publish(channel, Buffer.from(data))
    } catch (error) {
      throw new TransportError(
        `Failed to publish to channel '${channel}' on ${this.name}: ${(error as Error).message}`,
        TransportErrorCode.PUBLISH_FAILED,
        {
          context: { transport: this.name, channel, operation: 'publish', retryable: true },
          cause: error as Error,
        },
      )
    }
  }

  async subscribe(channel: string, handler: TransportMessageHandler): Promise<void> {
    if (!this.#subscriber?.isReady) {
      throw new TransportError(
        `${this.name} transport is not ready for subscribe`,
        TransportErrorCode.NOT_READY,
        {
          context: { transport: this.name, operation: 'subscribe', retryable: false },
        },
      )
    }

    if (!this.#subscriptions.has(channel)) {
      this.#subscriptions.set(channel, new Set())

      try {
        await this.#subscriber.subscribe(channel, (message) => {
          const data = new Uint8Array(Buffer.from(message))

          const handlers = this.#subscriptions.get(channel)

          if (handlers) {
            for (const h of handlers) {
              Promise.resolve(h(data)).catch(() => {})
            }
          }
        })
      } catch (error) {
        this.#subscriptions.delete(channel)
        throw new TransportError(
          `Failed to subscribe to channel '${channel}' on ${this.name}: ${
            (error as Error).message
          }`,
          TransportErrorCode.SUBSCRIBE_FAILED,
          {
            context: { transport: this.name, channel, operation: 'subscribe', retryable: true },
            cause: error as Error,
          },
        )
      }
    }

    this.#subscriptions.get(channel)?.add(handler)
  }

  async unsubscribe(channel: string): Promise<void> {
    if (!this.#subscriber?.isReady) {
      throw new TransportError(
        `${this.name} transport is not ready for unsubscribe`,
        TransportErrorCode.NOT_READY,
        {
          context: { transport: this.name, operation: 'unsubscribe', retryable: false },
        },
      )
    }

    try {
      await this.#subscriber.unsubscribe(channel)
      this.#subscriptions.delete(channel)
    } catch (error) {
      throw new TransportError(
        `Failed to unsubscribe from channel '${channel}' on ${this.name}: ${
          (error as Error).message
        }`,
        TransportErrorCode.UNSUBSCRIBE_FAILED,
        {
          context: { transport: this.name, channel, operation: 'unsubscribe', retryable: true },
          cause: error as Error,
        },
      )
    }
  }
}

/** @public */
export function redis(config?: RedisTransportConfig): RedisTransport {
  return new RedisTransport(config)
}
