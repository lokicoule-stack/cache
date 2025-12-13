import { MessageDispatcher } from './internal/message-dispatcher'
import { SubscriptionManager } from './internal/subscription-manager'

import type { Bus } from '@/contracts/bus'
import type { Codec, CodecOption } from '@/contracts/codec'
import type { Transport } from '@/contracts/transport'
import type { MessageHandler, Serializable } from '@/types'

import { type MiddlewareConfig, composeMiddleware } from '@/core/middleware/middleware'
import { createCodec } from '@/infrastructure/codecs'

/**
 * Bus configuration options.
 *
 * @public
 */
export interface BusOptions {
  /** Transport implementation */
  transport: Transport

  /** Codec for serialization (default: 'msgpack') */
  codec?: CodecOption

  /** Middleware configuration */
  middleware?: MiddlewareConfig

  /** Handler error callback */
  onHandlerError?: (channel: string, error: Error) => void
}

/**
 * Main message bus implementation.
 * Coordinates between transport, codec, and subscription management.
 *
 * @public
 */
export class MessageBus implements Bus {
  readonly #transport: Transport
  readonly #codec: Codec
  readonly #subscriptions: SubscriptionManager
  readonly #dispatcher: MessageDispatcher

  constructor(options: BusOptions) {
    this.#transport = composeMiddleware(options.transport, options.middleware)
    this.#codec = createCodec(options.codec)
    this.#dispatcher = new MessageDispatcher(this.#codec, options.onHandlerError)
    this.#subscriptions = new SubscriptionManager()
  }

  async connect(): Promise<void> {
    await this.#transport.connect()
  }

  async disconnect(): Promise<void> {
    const channels = this.#subscriptions.getAllChannels()

    await Promise.all(channels.map((channel) => this.unsubscribe(channel)))
    await this.#transport.disconnect()
  }

  async publish<T extends Serializable>(channel: string, data: T): Promise<void> {
    const bytes = this.#codec.encode(data)

    await this.#transport.publish(channel, bytes)
  }

  async subscribe<T extends Serializable>(
    channel: string,
    handler: MessageHandler<T>,
  ): Promise<void> {
    const subscription = this.#subscriptions.getOrCreate(channel)
    const isFirstHandler = subscription.handlerCount === 0

    subscription.addHandler(handler as MessageHandler)

    if (!isFirstHandler) {
      return
    }

    try {
      await this.#transport.subscribe(channel, async (bytes) => {
        await this.#dispatcher.dispatch(channel, bytes, subscription)
      })
    } catch (error) {
      subscription.removeHandler(handler as MessageHandler)

      if (subscription.handlerCount === 0) {
        this.#subscriptions.delete(channel)
      }

      throw error
    }
  }

  async unsubscribe(channel: string, handler?: MessageHandler): Promise<void> {
    const subscription = this.#subscriptions.get(channel)

    if (!subscription) {
      return
    }

    if (handler) {
      subscription.removeHandler(handler)

      if (subscription.handlerCount === 0) {
        await this.#transport.unsubscribe(channel)
        this.#subscriptions.delete(channel)
      }

      return
    }

    await this.#transport.unsubscribe(channel)
    this.#subscriptions.delete(channel)
  }
}
