import type { MessageHandler, Serializable } from '../types'

/**
 * Bus contract - defines the public API for type-safe message bus
 *
 * Provides pub/sub messaging with strong typing, codec abstraction,
 * and transport independence. Messages are fire-and-forget with
 * automatic serialization/deserialization.
 */
export interface IBus {
  /**
   * Connect the bus transport
   *
   * Initializes the underlying transport connection. Must be called before
   * publishing or subscribing to messages.
   *
   * @returns Promise that resolves when connection is established
   * @throws {BusOperationError} If connection fails
   */
  connect(): Promise<void>

  /**
   * Disconnect the bus transport
   *
   * Closes the transport connection and automatically unsubscribes from all
   * channels. Any pending messages may be lost.
   *
   * @returns Promise that resolves when disconnection is complete
   * @throws {BusOperationError} If disconnection fails
   */
  disconnect(): Promise<void>

  /**
   * Publish a message to a channel
   *
   * Serializes the data using the configured codec and sends it through
   * the underlying transport. This is a fire-and-forget operation -
   * subscribers receive the message asynchronously.
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
  publish<T extends Serializable>(channel: string, data: T): Promise<void>

  /**
   * Subscribe to a channel
   *
   * Registers a handler to receive messages from the specified channel.
   * Multiple handlers can subscribe to the same channel - all will receive
   * each message independently.
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
  subscribe<T extends Serializable>(channel: string, handler: MessageHandler<T>): Promise<void>

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
  unsubscribe(channel: string, handler?: MessageHandler): Promise<void>

  /**
   * Get list of subscribed channels
   *
   * Returns an array of channel names that have active subscriptions.
   * Useful for debugging and monitoring.
   *
   * @example
   * ```typescript
   * console.log('Active channels:', bus.channels) // ['users.created', 'orders.paid']
   * ```
   */
  readonly channels: string[]
}
