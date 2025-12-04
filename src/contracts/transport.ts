import type { TransportData, TransportMessageHandler } from '../types'

/**
 * Transport contract - abstracts the underlying messaging system
 *
 * Provides a unified interface for different messaging backends (memory, Redis, etc.).
 * Transports handle the low-level pub/sub mechanics and connection lifecycle.
 */
export interface Transport {
  /**
   * Transport name identifier
   *
   * Used for logging, debugging, and error messages.
   *
   * @example 'memory', 'redis', 'rabbitmq'
   */
  readonly name: string

  /**
   * Connect to the transport
   *
   * Establishes connection to the underlying messaging system.
   * Must be called before publish or subscribe operations.
   * Idempotent - multiple calls should not create duplicate connections.
   *
   * @returns Promise that resolves when connection is established
   * @throws {TransportConnectionError} If connection fails
   */
  connect(): Promise<void>

  /**
   * Disconnect from the transport
   *
   * Closes the connection and releases resources.
   * Should cleanup all active subscriptions.
   * Idempotent - safe to call multiple times.
   *
   * @returns Promise that resolves when disconnection is complete
   * @throws {TransportError} If disconnection fails
   */
  disconnect(): Promise<void>

  /**
   * Publish a message to a channel
   *
   * Sends binary data to all subscribers of the specified channel.
   * Fire-and-forget operation - does not wait for subscriber acknowledgment.
   *
   * @param channel - The channel name to publish to
   * @param data - The binary message data
   * @returns Promise that resolves when message is sent
   * @throws {TransportNotReadyError} If transport is not connected
   * @throws {TransportPublishError} If publish operation fails
   */
  publish(channel: string, data: TransportData): Promise<void>

  /**
   * Subscribe to a channel
   *
   * Registers a handler to receive messages from the specified channel.
   * The handler is called asynchronously for each message received.
   * Multiple subscriptions to the same channel should be supported.
   *
   * @param channel - The channel name to subscribe to
   * @param handler - Function to handle incoming messages
   * @returns Promise that resolves when subscription is active
   * @throws {TransportNotReadyError} If transport is not connected
   * @throws {TransportSubscribeError} If subscription fails
   */
  subscribe(channel: string, handler: TransportMessageHandler): Promise<void>

  /**
   * Unsubscribe from a channel
   *
   * Removes all subscriptions from the specified channel.
   * Should stop receiving messages after this call.
   *
   * @param channel - The channel name to unsubscribe from
   * @returns Promise that resolves when unsubscription is complete
   * @throws {TransportNotReadyError} If transport is not connected
   * @throws {TransportError} If unsubscription fails
   */
  unsubscribe(channel: string): Promise<void>
}
