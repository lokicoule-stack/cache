import { BusOperationError, HandlerError } from './bus-errors'
import { resolveCodec } from './codec-resolver'

import type { Bus } from '@/contracts/bus'
import type { CodecOption, Codec } from '@/contracts/codec'
import type { Transport, MessageHandler, Serializable } from '@/types'

/**
 * Bus configuration options
 *
 * @example Basic usage with magic string
 * ```typescript
 * const bus = new Bus({
 *   transport: memory(),
 *   codec: 'msgpack'  // Magic string - resolved automatically
 * })
 * ```
 *
 * @example Advanced usage with custom codec (DI)
 * ```typescript
 * import { JsonCodec } from '@lokiverse/bus/infrastructure/codecs'
 *
 * const bus = new Bus({
 *   transport: memory(),
 *   codec: new JsonCodec()  // Direct injection for advanced use cases
 * })
 * ```
 */
export interface BusOptions {
  /**
   * The underlying transport implementation
   *
   * Use transport factory functions like `memory()` or `redis()`
   * or provide a custom implementation of the Transport interface.
   *
   * @example
   * ```typescript
   * import { memory, redis } from '@lokiverse/bus'
   *
   * // Memory transport (testing/development)
   * const memTransport = memory()
   *
   * // Redis transport (production)
   * const redisTransport = redis({ host: 'localhost', port: 6379 })
   * ```
   */
  transport: Transport

  /**
   * Codec for message serialization/deserialization
   *
   * Supports both magic strings for built-in codecs and direct injection
   * of custom codec implementations (Dependency Injection pattern).
   *
   * **Built-in codecs (magic strings)**:
   * - `'json'` (default): Standard JSON serialization, human-readable
   * - `'msgpack'`: Binary MessagePack, more compact and faster
   *
   * **Custom codec (DI)**: Provide your own Codec implementation
   *
   * @default 'json'
   *
   * @example Magic string (simple)
   * ```typescript
   * const bus = new Bus({ transport, codec: 'msgpack' })
   * ```
   *
   * @example Custom codec (advanced)
   * ```typescript
   * const customCodec: Codec = {
   *   name: 'protobuf',
   *   encode: (data) => /* ... *\/,
   *   decode: (data) => /* ... *\/
   * }
   * const bus = new Bus({ transport, codec: customCodec })
   * ```
   */
  codec?: CodecOption

  /**
   * Error handler for subscriber execution errors
   *
   * Called when a message handler throws an error. Allows custom error
   * handling, logging, or monitoring without disrupting other handlers.
   *
   * **Important**: Errors are isolated - one handler's failure does not
   * prevent other handlers from receiving the message.
   *
   * @param channel - The channel where the error occurred
   * @param error - The error thrown by the handler
   *
   * @default undefined (errors are swallowed to prevent cascading failures)
   *
   * @example Logging errors
   * ```typescript
   * const bus = new Bus({
   *   transport,
   *   onHandlerError: (channel, error) => {
   *     console.error(`Handler error on ${channel}:`, error)
   *     // Send to monitoring service
   *     monitoring.recordError(error)
   *   }
   * })
   * ```
   */
  onHandlerError?: (channel: string, error: Error) => void
}

export class MessageBus implements Bus {
  #transport: Transport
  #codec: Codec
  #handlers = new Map<string, Set<MessageHandler>>()
  #onHandlerError?: (channel: string, error: Error) => void

  constructor(options: BusOptions) {
    this.#transport = options.transport
    this.#codec = resolveCodec(options.codec)
    this.#onHandlerError = options.onHandlerError
  }

  /**
   * Connect the bus transport
   *
   * Initializes the underlying transport connection. Must be called before
   * publishing or subscribing to messages.
   *
   * @returns Promise that resolves when connection is established
   * @throws {BusOperationError} If connection fails
   */
  async connect(): Promise<void> {
    try {
      await this.#transport.connect()
    } catch (error) {
      throw new BusOperationError('connect', error as Error)
    }
  }

  /**
   * Disconnect the bus transport
   *
   * Automatically unsubscribes from all channels before closing the
   * transport connection. Any pending messages may be lost.
   *
   * @returns Promise that resolves when disconnection is complete
   * @throws {BusOperationError} If disconnection fails
   */
  async disconnect(): Promise<void> {
    try {
      for (const channel of this.#handlers.keys()) {
        await this.unsubscribe(channel)
      }
      await this.#transport.disconnect()
    } catch (error) {
      throw new BusOperationError('disconnect', error as Error)
    }
  }

  /**
   * Publish a message to a channel
   *
   * Serializes the data using the configured codec and sends it through
   * the underlying transport. This is a fire-and-forget operation.
   *
   * @template T - The message data type (must extend Serializable)
   * @param channel - The channel name to publish to
   * @param data - The message data to publish
   * @returns Promise that resolves when the message is published
   * @throws {BusOperationError} If the publish operation fails
   * @throws {CodecError} If data serialization fails
   *
   * @example
   * ```typescript
   * await bus.publish('users.created', { id: 123, name: 'Alice' })
   * ```
   */
  async publish<T extends Serializable>(channel: string, data: T): Promise<void> {
    try {
      const bytes = this.#codec.encode(data)

      await this.#transport.publish(channel, bytes)
    } catch (error) {
      throw new BusOperationError('publish', error as Error)
    }
  }

  /**
   * Subscribe to a channel
   *
   * Registers a handler to receive messages from the specified channel.
   * Multiple handlers can subscribe to the same channel - all will receive
   * each message independently. Handler errors are isolated and don't affect
   * other handlers or the bus itself.
   *
   * @template T - The expected message data type (must extend Serializable)
   * @param channel - The channel name to subscribe to
   * @param handler - Function to handle incoming messages
   * @returns Promise that resolves when subscription is active
   * @throws {BusOperationError} If subscription fails
   *
   * @example
   * ```typescript
   * await bus.subscribe<UserEvent>('users.created', (data) => {
   *   console.log('User created:', data.name)
   * })
   * ```
   */
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
        throw new BusOperationError('subscribe', error as Error)
      }
    }

    this.#handlers.get(channel)?.add(handler as MessageHandler)
  }

  /**
   * Unsubscribe from a channel
   *
   * Removes a specific handler or all handlers from the channel.
   * If no handler is specified, all handlers are removed and the
   * transport subscription is closed.
   *
   * @param channel - The channel name to unsubscribe from
   * @param handler - Specific handler to remove (optional, removes all if omitted)
   * @returns Promise that resolves when unsubscription is complete
   * @throws {BusOperationError} If unsubscription fails
   *
   * @example
   * ```typescript
   * // Remove specific handler
   * await bus.unsubscribe('users.created', myHandler)
   *
   * // Remove all handlers from channel
   * await bus.unsubscribe('users.created')
   * ```
   */
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
      throw new BusOperationError('unsubscribe', error as Error)
    }
  }

  /**
   * Handle errors from handler execution
   *
   * Wraps handler errors in HandlerError and invokes the onHandlerError
   * callback if configured. Errors are swallowed to prevent cascading
   * failures - one handler's error should not affect other handlers.
   *
   * @param channel - The channel where the error occurred
   * @param error - The error that was thrown
   * @private
   */
  #handleError(channel: string, error: Error): void {
    const handlerError = new HandlerError(channel, error)

    if (this.#onHandlerError) {
      this.#onHandlerError(channel, handlerError)
    }
  }
}
