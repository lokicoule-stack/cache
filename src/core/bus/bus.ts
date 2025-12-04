import { BusOperationError, HandlerError } from '@/shared/errors'
import { createCodec, type CodecOption, type ICodec } from '../codec'

import type { ITransport } from '../transport'
import type { MessageHandler, Serializable } from '../types'
import type { IBus } from './bus.contract'

/**
 * Bus configuration options
 *
 * @property transport - The underlying transport implementation (required)
 * @property codec - Codec for serialization (default: 'json'). Can be 'json',
 *                   'msgpack', or a custom ICodec implementation.
 * @property onHandlerError - Error handler for subscriber execution errors.
 *                            Receives channel name and error. Does not prevent
 *                            other handlers from executing. If not provided,
 *                            errors are swallowed to prevent cascading failures.
 */
export interface BusOptions {
  transport: ITransport
  codec?: CodecOption
  onHandlerError?: (channel: string, error: Error) => void
}

/**
 * Type-safe message bus implementation
 *
 * Implements pub/sub messaging with automatic codec-based serialization,
 * transport abstraction, and error isolation between handlers.
 *
 * @example
 * ```typescript
 * const transport = memory()
 * const bus = new Bus({ transport, codec: 'json' })
 *
 * await bus.connect()
 *
 * await bus.subscribe<UserEvent>('users.created', (data) => {
 *   console.log('User created:', data.name)
 * })
 *
 * await bus.publish('users.created', { id: 123, name: 'Alice' })
 *
 * await bus.disconnect()
 * ```
 */
export class Bus implements IBus {
  #transport: ITransport
  #codec: ICodec
  #handlers = new Map<string, Set<MessageHandler>>()
  #onHandlerError?: (channel: string, error: Error) => void

  /**
   * Create a new Bus instance
   *
   * @param options - Bus configuration options
   */
  constructor(options: BusOptions) {
    this.#transport = options.transport
    this.#codec = createCodec(options.codec)
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
   * Get list of subscribed channels
   *
   * Returns an array of channel names that have active subscriptions.
   * Useful for debugging and monitoring.
   */
  get channels(): string[] {
    return Array.from(this.#handlers.keys())
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
