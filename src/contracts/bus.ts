import type { MessageHandler, Serializable } from '../types'

/**
 * Base schema type for bus channels.
 * Maps channel names to their payload types.
 *
 * @example
 * ```typescript
 * type MySchema = {
 *   'user:created': { id: string; email: string }
 *   'order:placed': { orderId: string; total: number }
 * }
 * ```
 *
 * @public
 */
export type BusSchema = Record<string, Serializable>

/**
 * Default schema that allows any channel with any serializable payload.
 * Used when no schema is provided for backward compatibility.
 *
 * @internal
 */
export type DefaultSchema = Record<string, Serializable>

/**
 * Extracts channel names from a schema.
 *
 * @internal
 */
export type ChannelOf<Schema extends BusSchema> = keyof Schema & string

/**
 * Extracts payload type for a specific channel.
 *
 * @internal
 */
export type PayloadOf<Schema extends BusSchema, Channel extends ChannelOf<Schema>> = Schema[Channel]

/**
 * Message bus abstraction with optional schema-based type safety.
 *
 * @remarks
 * Handles pub/sub messaging with codec abstraction and middleware support.
 *
 * When a Schema type is provided, channel names and payload types are
 * validated at compile time. Without a schema, any channel/payload is allowed.
 *
 * @example
 * ```typescript
 * // Without schema (backward compatible)
 * const bus: Bus = new MessageBus({ transport: memory() })
 * await bus.publish('any-channel', { any: 'data' })
 *
 * // With schema (type-safe)
 * type MySchema = { 'orders': { id: string } }
 * const bus: Bus<MySchema> = new MessageBus({ transport: memory() })
 * await bus.publish('orders', { id: '123' }) // OK
 * await bus.publish('orders', { id: 123 })   // Error: id must be string
 * await bus.publish('invalid', {})           // Error: channel not in schema
 * ```
 *
 * @public
 */
export interface Bus<Schema extends BusSchema = DefaultSchema> {
  /** Establish connection */
  connect(): Promise<void>

  /** Close connection */
  disconnect(): Promise<void>

  /** Publish message to channel */
  publish<C extends ChannelOf<Schema>>(channel: C, data: PayloadOf<Schema, C>): Promise<void>

  /** Subscribe to channel messages */
  subscribe<C extends ChannelOf<Schema>>(
    channel: C,
    handler: MessageHandler<PayloadOf<Schema, C>>,
  ): Promise<void>

  /** Unsubscribe from channel */
  unsubscribe<C extends ChannelOf<Schema>>(
    channel: C,
    handler?: MessageHandler<PayloadOf<Schema, C>>,
  ): Promise<void>
}

/**
 * Telemetry event emitted when a message is published.
 *
 * @public
 */
export interface PublishEvent {
  /** Channel name */
  channel: string

  /** Encoded payload size in bytes */
  payloadSize: number

  /** Codec used for encoding */
  codecUsed: string

  /** Event timestamp (milliseconds since epoch) */
  timestamp: number

  /** Publish operation duration in milliseconds (only present after completion) */
  duration?: number
}

/**
 * Telemetry event emitted when subscribing to a channel.
 *
 * @public
 */
export interface SubscribeEvent {
  /** Channel name */
  channel: string

  /** Number of handlers after subscription */
  handlerCount: number

  /** Event timestamp (milliseconds since epoch) */
  timestamp: number
}

/**
 * Telemetry event emitted when unsubscribing from a channel.
 *
 * @public
 */
export interface UnsubscribeEvent {
  /** Channel name */
  channel: string

  /** Number of handlers remaining after unsubscribe */
  handlerCount: number

  /** Event timestamp (milliseconds since epoch) */
  timestamp: number
}

/**
 * Telemetry event emitted when an error occurs.
 *
 * @public
 */
export interface ErrorEvent {
  /** Channel name (if applicable) */
  channel?: string

  /** Error instance */
  error: Error

  /** Operation that caused the error */
  operation: 'publish' | 'subscribe' | 'unsubscribe' | 'decode' | 'handler'

  /** Event timestamp (milliseconds since epoch) */
  timestamp: number

  /** Additional context */
  context?: Record<string, unknown>
}

/**
 * Telemetry event emitted when a message handler is executed.
 *
 * @public
 */
export interface HandlerExecutionEvent {
  /** Channel name */
  channel: string

  /** Handler execution duration in milliseconds */
  duration: number

  /** Whether the handler succeeded */
  success: boolean

  /** Error if handler failed */
  error?: Error

  /** Event timestamp (milliseconds since epoch) */
  timestamp: number
}

/**
 * Observability hooks for monitoring bus operations.
 *
 * @remarks
 * All callbacks are optional and non-blocking. Errors thrown in callbacks
 * are caught and logged to prevent disrupting bus operations.
 *
 * @public
 */
export interface BusTelemetry {
  /**
   * Called when a message is published.
   * Invoked twice: before publish (without duration) and after (with duration).
   */
  onPublish?: (event: PublishEvent) => void | Promise<void>

  /** Called when subscribing to a channel */
  onSubscribe?: (event: SubscribeEvent) => void | Promise<void>

  /** Called when unsubscribing from a channel */
  onUnsubscribe?: (event: UnsubscribeEvent) => void | Promise<void>

  /** Called when an error occurs */
  onError?: (event: ErrorEvent) => void | Promise<void>

  /** Called after each message handler execution */
  onHandlerExecution?: (event: HandlerExecutionEvent) => void | Promise<void>
}
