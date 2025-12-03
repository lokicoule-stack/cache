import { createClient, type RedisClientOptions } from 'redis'

import type { ITransport, TransportData, TransportMessageHandler } from '../types'

export type RedisTransportConfig = RedisClientOptions

/**
 * Redis Pub/Sub transport
 */
export class RedisTransport implements ITransport {
  readonly name = 'redis'

  #publisher?: ReturnType<typeof createClient>
  #subscriber?: ReturnType<typeof createClient>
  #config: RedisTransportConfig
  #subscriptions = new Map<string, Set<TransportMessageHandler>>()

  constructor(config: RedisTransportConfig = {}) {
    this.#config = config
  }

  async connect(): Promise<void> {
    this.#publisher = createClient(this.#config)
    this.#subscriber = this.#publisher.duplicate()

    await Promise.all([this.#publisher.connect(), this.#subscriber.connect()])
  }

  async disconnect(): Promise<void> {
    await Promise.all([this.#publisher?.quit(), this.#subscriber?.quit()])

    this.#publisher = undefined
    this.#subscriber = undefined
    this.#subscriptions.clear()
  }

  async publish(channel: string, data: TransportData): Promise<void> {
    if (!this.#publisher?.isReady) {
      throw new Error('Redis publisher not connected')
    }

    await this.#publisher.publish(channel, Buffer.from(data))
  }

  async subscribe(channel: string, handler: TransportMessageHandler): Promise<void> {
    if (!this.#subscriber?.isReady) {
      throw new Error('Redis subscriber not connected')
    }

    if (!this.#subscriptions.has(channel)) {
      this.#subscriptions.set(channel, new Set())

      await this.#subscriber.subscribe(channel, (message) => {
        const data = new Uint8Array(Buffer.from(message))

        const handlers = this.#subscriptions.get(channel)

        if (handlers) {
          for (const h of handlers) {
            Promise.resolve(h(data)).catch(() => {})
          }
        }
      })
    }

    this.#subscriptions.get(channel)?.add(handler)
  }

  async unsubscribe(channel: string): Promise<void> {
    if (!this.#subscriber?.isReady) {
      throw new Error('Redis subscriber not connected')
    }

    await this.#subscriber.unsubscribe(channel)
    this.#subscriptions.delete(channel)
  }
}

export function redis(config?: RedisTransportConfig): RedisTransport {
  return new RedisTransport(config)
}
