import type { MessageHandler, Serializable } from '../types'

/**
 * Message bus abstraction.
 *
 * @remarks
 * Handles pub/sub messaging with codec abstraction and middleware support.
 *
 * @public
 */
export interface Bus {
  /** Establish connection */
  connect(): Promise<void>

  /** Close connection */
  disconnect(): Promise<void>

  /** Publish message to channel */
  publish<T extends Serializable>(channel: string, data: T): Promise<void>

  /** Subscribe to channel messages */
  subscribe<T extends Serializable>(channel: string, handler: MessageHandler<T>): Promise<void>

  /** Unsubscribe from channel */
  unsubscribe(channel: string, handler?: MessageHandler): Promise<void>
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
