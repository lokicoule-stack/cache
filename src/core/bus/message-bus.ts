import { MessageDispatcher } from './internal/message-dispatcher'
import { SubscriptionManager } from './internal/subscription-manager'

import type { Bus, BusTelemetry, HandlerExecutionEvent } from '@/contracts/bus'
import type { Codec, CodecOption } from '@/contracts/codec'
import type { Transport } from '@/contracts/transport'
import type { MessageHandler, Serializable } from '@/types'

import { type MiddlewareConfig, composeMiddleware } from '@/core/middleware/middleware'
import debug from '@/debug'
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

  /** Maximum payload size in bytes (default: 10MB) */
  maxPayloadSize?: number

  /** Observability hooks for monitoring */
  telemetry?: BusTelemetry

  /** Auto-connect on first publish/subscribe (default: true) */
  autoConnect?: boolean
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
  readonly #telemetry?: BusTelemetry
  readonly #autoConnect: boolean
  #connected = false
  #connecting?: Promise<void>

  constructor(options: BusOptions) {
    this.#transport = composeMiddleware(options.transport, options.middleware)
    this.#codec = createCodec(options.codec, options.maxPayloadSize)
    this.#telemetry = options.telemetry
    this.#autoConnect = options.autoConnect ?? true

    const onHandlerExecution = options.telemetry?.onHandlerExecution
      ? (event: HandlerExecutionEvent) => {
          void this.#emitTelemetry('onHandlerExecution', event)
        }
      : undefined

    this.#dispatcher = new MessageDispatcher(
      this.#codec,
      options.onHandlerError,
      onHandlerExecution,
    )
    this.#subscriptions = new SubscriptionManager()

    this.#setupReconnectionHandler()
  }

  async connect(): Promise<void> {
    if (this.#connected) {
      return
    }

    if (this.#connecting) {
      return this.#connecting
    }

    this.#connecting = this.#transport.connect().then(() => {
      this.#connected = true
      this.#connecting = undefined
    })

    return this.#connecting
  }

  async disconnect(): Promise<void> {
    const channels = this.#subscriptions.getAllChannels()

    await Promise.all(channels.map((channel) => this.unsubscribe(channel)))
    await this.#transport.disconnect()
    this.#connected = false
    this.#connecting = undefined
  }

  async publish<T extends Serializable>(channel: string, data: T): Promise<void> {
    await this.#ensureConnected()

    const startTime = performance.now()

    try {
      const bytes = this.#codec.encode(data)

      void this.#emitTelemetry('onPublish', {
        channel,
        payloadSize: bytes.length,
        codecUsed: this.#codec.name,
        timestamp: Date.now(),
      })

      await this.#transport.publish(channel, bytes)

      void this.#emitTelemetry('onPublish', {
        channel,
        payloadSize: bytes.length,
        codecUsed: this.#codec.name,
        timestamp: Date.now(),
        duration: performance.now() - startTime,
      })
    } catch (error) {
      void this.#emitTelemetry('onError', {
        channel,
        error: error as Error,
        operation: 'publish',
        timestamp: Date.now(),
        context: { codecUsed: this.#codec.name },
      })

      throw error
    }
  }

  async subscribe<T extends Serializable>(
    channel: string,
    handler: MessageHandler<T>,
  ): Promise<void> {
    await this.#ensureConnected()

    const subscription = this.#subscriptions.getOrCreate(channel)
    const isFirstHandler = subscription.handlerCount === 0

    subscription.addHandler(handler as MessageHandler)

    void this.#emitTelemetry('onSubscribe', {
      channel,
      handlerCount: subscription.handlerCount,
      timestamp: Date.now(),
    })

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

      void this.#emitTelemetry('onError', {
        channel,
        error: error as Error,
        operation: 'subscribe',
        timestamp: Date.now(),
      })

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

      const handlerCount = subscription.handlerCount

      void this.#emitTelemetry('onUnsubscribe', {
        channel,
        handlerCount,
        timestamp: Date.now(),
      })

      if (handlerCount === 0) {
        await this.#transport.unsubscribe(channel)
        this.#subscriptions.delete(channel)
      }

      return
    }

    await this.#transport.unsubscribe(channel)
    this.#subscriptions.delete(channel)

    void this.#emitTelemetry('onUnsubscribe', {
      channel,
      handlerCount: 0,
      timestamp: Date.now(),
    })
  }

  async #ensureConnected(): Promise<void> {
    if (this.#connected) {
      return
    }

    if (this.#autoConnect) {
      await this.connect()
    }
  }

  #setupReconnectionHandler(): void {
    this.#transport.onReconnect(() => {
      const channels = this.#subscriptions.getAllChannels()

      if (channels.length === 0) {
        return
      }

      debug('[RECONNECT] Re-subscribing to %d channels', channels.length)

      void Promise.all(
        channels.map(async (channel) => {
          const subscription = this.#subscriptions.get(channel)

          if (!subscription) {
            return
          }

          try {
            await this.#transport.subscribe(channel, async (bytes) => {
              await this.#dispatcher.dispatch(channel, bytes, subscription)
            })

            debug('[RECONNECT] Re-subscribed to channel: %s', channel)
          } catch (error) {
            debug('[RECONNECT ERROR] Failed to re-subscribe to channel %s:', channel, error)
          }
        }),
      ).catch((error) => {
        debug('[RECONNECT ERROR] Failed to re-subscribe channels:', error)
      })
    })
  }

  async #emitTelemetry<K extends keyof BusTelemetry>(
    event: K,
    data: Parameters<NonNullable<BusTelemetry[K]>>[0],
  ): Promise<void> {
    const callback = this.#telemetry?.[event]

    if (!callback) {
      return
    }

    try {
      await callback(data as never)
    } catch (error) {
      debug('[TELEMETRY ERROR] %s:', event, error)
    }
  }
}
