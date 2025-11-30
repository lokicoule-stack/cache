import assert from 'node:assert'

import { createClient, type RedisClientOptions } from 'redis'

import { BaseTransport } from '../base-transport'

import type { MessageHandler } from '../transport'

/** Redis transport configuration */
export type RedisTransportConfig = RedisClientOptions 

/**
 * Redis Pub/Sub transport
 *
 * Requires `redis` package (optional peer dependency).
 *
 * @example
 * ```ts
 * import { RedisTransport } from '@lokiverse/bus'
 *
 * const transport = new RedisTransport({
 *   socket: { host: 'localhost', port: 6379 }
 * })
 * ```
 */
export class RedisTransport extends BaseTransport {
  #publisher: ReturnType<typeof createClient> | undefined
  #subscriber: ReturnType<typeof createClient> | undefined
  #config: RedisTransportConfig

  constructor(config: RedisTransportConfig = {}) {
    super('redis')
    this.#config = config
  }

  protected async doConnect(): Promise<void> {
    this.#publisher = createClient(this.#config)
    this.#subscriber = this.#publisher.duplicate()

    await Promise.all([this.#publisher.connect(), this.#subscriber.connect()])
  }

  protected async doDisconnect(): Promise<void> {
    if (this.#publisher) {
      await this.#publisher.quit()
      this.#publisher = undefined
    }

    if (this.#subscriber) {
      await this.#subscriber.quit()
      this.#subscriber = undefined
    }
  }

  protected async doPublish(channel: string, data: Uint8Array): Promise<void> {
    assert(this.#publisher, 'Publisher not connected')

    await this.#publisher.publish(channel, Buffer.from(data))
  }

  protected async doSubscribe(channel: string, handler: MessageHandler): Promise<void> {
    assert(this.#subscriber, 'Subscriber not connected')

    const handlers = this.getHandlers(channel)
    if (!handlers || handlers.size === 0) {
      await this.#subscriber.subscribe(channel, (message: string) => {
        void handler(new Uint8Array(Buffer.from(message)))
      })
    }
  }

  protected async doUnsubscribe(channel: string): Promise<void> {
    assert(this.#subscriber, 'Subscriber not connected')

    await this.#subscriber.unsubscribe(channel)
  }
}

export function redis(config?: RedisTransportConfig): RedisTransport {
  return new RedisTransport(config)
}

export function createRedisTransport(config?: RedisTransportConfig): RedisTransport {
  return new RedisTransport(config)
}
