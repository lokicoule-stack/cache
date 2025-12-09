import { BusError, BusErrorCode } from './bus-errors'

import type { Bus } from '@/contracts/bus'
import type { CodecOption, Codec, AutoCodecConfig } from '@/contracts/codec'
import type { Transport } from '@/contracts/transport'
import type { MessageHandler, Serializable } from '@/types'

import { type MiddlewareConfig, composeMiddleware } from '@/core/middleware/middleware'
import { AutoCodec } from '@/infrastructure/codecs/auto-codec'
import { InvalidCodecError } from '@/infrastructure/codecs/codec-errors'
import { JsonCodec } from '@/infrastructure/codecs/json-codec'
import { MsgPackCodec } from '@/infrastructure/codecs/msgpack-codec'

/**
 * Bus configuration options.
 *
 * @public
 */
export interface BusOptions {
  /** Transport implementation */
  transport: Transport

  /** Codec for serialization (default: 'auto') */
  codec?: CodecOption

  /** Middleware configuration */
  middleware?: MiddlewareConfig

  /** Handler error callback */
  onHandlerError?: (channel: string, error: Error) => void
}

/**
 * @public
 */
export class MessageBus implements Bus {
  #transport: Transport
  #codec: Codec
  #handlers = new Map<string, Set<MessageHandler>>()
  #onHandlerError?: (channel: string, error: Error) => void

  constructor(options: BusOptions) {
    this.#transport = composeMiddleware(options.transport, options.middleware)
    this.#codec = this.#resolveCodec(options.codec)
    this.#onHandlerError = options.onHandlerError
  }

  /** Connect the bus transport. @throws \{BusError\} */
  async connect(): Promise<void> {
    try {
      await this.#transport.connect()
    } catch (error) {
      throw new BusError(
        `Failed to connect bus: ${(error as Error).message}`,
        BusErrorCode.TRANSPORT_FAILED,
        {
          context: { operation: 'connect', transport: this.#transport.name },
          cause: error as Error,
        },
      )
    }
  }

  /** Disconnect the bus transport. @throws \{BusError\} */
  async disconnect(): Promise<void> {
    try {
      for (const channel of this.#handlers.keys()) {
        await this.unsubscribe(channel)
      }
      await this.#transport.disconnect()
    } catch (error) {
      throw new BusError(
        `Failed to disconnect bus: ${(error as Error).message}`,
        BusErrorCode.TRANSPORT_FAILED,
        {
          context: { operation: 'disconnect', transport: this.#transport.name },
          cause: error as Error,
        },
      )
    }
  }

  /** Publish a message. @throws \{BusError\} */
  async publish<T extends Serializable>(channel: string, data: T): Promise<void> {
    try {
      const bytes = this.#codec.encode(data)

      await this.#transport.publish(channel, bytes)
    } catch (error) {
      throw new BusError(
        `Failed to publish message to channel '${channel}': ${(error as Error).message}`,
        BusErrorCode.TRANSPORT_FAILED,
        {
          context: { operation: 'publish', channel, transport: this.#transport.name },
          cause: error as Error,
        },
      )
    }
  }

  /** Subscribe to a channel. @throws \{BusError\} */
  async subscribe<T extends Serializable>(
    channel: string,
    handler: MessageHandler<T>,
  ): Promise<void> {
    if (!this.#handlers.has(channel)) {
      this.#handlers.set(channel, new Set())

      try {
        await this.#transport.subscribe(channel, (bytes) => {
          try {
            const data = this.#codec.decode<T>(bytes)
            const handlers = this.#handlers.get(channel)

            if (handlers) {
              for (const h of handlers) {
                try {
                  Promise.resolve(h(data)).catch((error: Error) => {
                    this.#handleError(channel, error)
                  })
                } catch (error) {
                  this.#handleError(channel, error as Error)
                }
              }
            }
          } catch (error) {
            this.#handleError(channel, error as Error)
          }
        })
      } catch (error) {
        this.#handlers.delete(channel)
        throw new BusError(
          `Failed to subscribe to channel '${channel}': ${(error as Error).message}`,
          BusErrorCode.CHANNEL_ERROR,
          {
            context: { operation: 'subscribe', channel, transport: this.#transport.name },
            cause: error as Error,
          },
        )
      }
    }

    this.#handlers.get(channel)?.add(handler as MessageHandler)
  }

  /** Unsubscribe from a channel. @throws \{BusError\} */
  async unsubscribe(channel: string, handler?: MessageHandler): Promise<void> {
    const handlers = this.#handlers.get(channel)

    if (!handlers) {
      return
    }

    try {
      if (handler) {
        handlers.delete(handler)
        if (handlers.size === 0) {
          await this.#transport.unsubscribe(channel)
          this.#handlers.delete(channel)
        }
      } else {
        await this.#transport.unsubscribe(channel)
        this.#handlers.delete(channel)
      }
    } catch (error) {
      throw new BusError(
        `Failed to unsubscribe from channel '${channel}': ${(error as Error).message}`,
        BusErrorCode.CHANNEL_ERROR,
        {
          context: { operation: 'unsubscribe', channel, transport: this.#transport.name },
          cause: error as Error,
        },
      )
    }
  }

  #resolveCodec(option?: CodecOption): Codec {
    if (!option || option === 'auto') {
      return new AutoCodec()
    }

    if (option === 'json') {
      return new JsonCodec()
    }

    if (option === 'msgpack') {
      return new MsgPackCodec()
    }

    if (typeof option === 'object') {
      if (this.#isAutoCodecConfig(option)) {
        return new AutoCodec(option.threshold)
      }

      // Direct Codec injection
      if (this.#isCodec(option)) {
        return option
      }
    }

    throw new InvalidCodecError(String(option))
  }

  #isAutoCodecConfig(option: object): option is AutoCodecConfig {
    return (
      'type' in option &&
      option.type === 'auto' &&
      (!('threshold' in option) ||
        option.threshold === undefined ||
        typeof option.threshold === 'number')
    )
  }

  #isCodec(option: object): option is Codec {
    return 'encode' in option && 'decode' in option && 'name' in option
  }

  // Errors are swallowed to prevent cascading failures
  #handleError(channel: string, error: Error): void {
    const handlerError = new BusError(
      `Handler failed for channel '${channel}': ${error.message}`,
      BusErrorCode.HANDLER_FAILED,
      {
        context: { operation: 'handle', channel },
        cause: error,
      },
    )

    if (this.#onHandlerError) {
      this.#onHandlerError(channel, handlerError)
    }
  }
}
