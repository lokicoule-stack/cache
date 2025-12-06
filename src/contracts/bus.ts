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
