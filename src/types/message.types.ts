import type { Serializable } from './serializable.types'

/**
 * Message handler for typed data (user-facing)
 *
 * Callback function invoked when a message is received on a subscribed channel.
 * Handlers receive decoded, type-safe data and can perform async operations.
 * Multiple handlers can subscribe to the same channel - each receives messages
 * independently. Handler errors are isolated and don't affect other handlers.
 *
 * @template T - The expected message data type (default: Serializable)
 * @param data - The decoded message data
 * @returns void or Promise<void> for async handlers
 *
 * @example
 * ```typescript
 * // Sync handler
 * const handler: MessageHandler<UserEvent> = (data) => {
 *   console.log('User created:', data.name)
 * }
 *
 * // Async handler
 * const asyncHandler: MessageHandler<OrderEvent> = async (data) => {
 *   await database.save(data)
 * }
 *
 * await bus.subscribe('users.created', handler)
 * ```
 */
export type MessageHandler<T = Serializable> = (data: T) => void | Promise<void>

/**
 * Internal transport data type (binary data)
 *
 * Represents raw binary message data as transmitted over the transport layer.
 * This is the low-level format used between transport and codec layers.
 * User-facing code works with Serializable types; codecs convert between
 * Serializable and TransportData.
 *
 * Using Uint8Array ensures:
 * - Cross-platform compatibility (Node.js, browsers, workers)
 * - Zero-copy operations where possible
 * - Efficient memory usage for large messages
 *
 * @example
 * ```typescript
 * // Codec layer converts between formats:
 * const data: Serializable = { id: 123 }
 * const bytes: TransportData = codec.encode(data)
 * await transport.publish('channel', bytes)
 * ```
 */
export type TransportData = Uint8Array

/**
 * Internal transport message handler (binary data)
 *
 * Low-level callback invoked by transports when raw binary data is received.
 * This handler operates at the transport layer, before codec decoding.
 * The bus layer wraps this with codec logic to provide type-safe MessageHandlers
 * to end users.
 *
 * @param data - Raw binary message data from the transport
 * @returns void or Promise<void> for async processing
 *
 * @example
 * ```typescript
 * // Internal usage in Bus implementation:
 * await transport.subscribe(channel, (bytes: TransportData) => {
 *   const data = codec.decode<T>(bytes)
 *   handlers.forEach(h => h(data)) // Invoke user MessageHandlers
 * })
 * ```
 */
export type TransportMessageHandler = (data: TransportData) => void | Promise<void>
