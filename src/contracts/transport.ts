import type { TransportData, TransportMessageHandler } from '@/types'

/**
 * Abstraction for message transport layer.
 *
 * @remarks
 * Implementations handle connection management and message routing.
 * Methods should be idempotent where applicable.
 *
 * @public
 */
export interface Transport {
  /** Transport identifier */
  readonly name: string

  /** Establish connection */
  connect(): Promise<void>

  /** Close connection (idempotent) */
  disconnect(): Promise<void>

  /**
   * Send message to channel
   * @throws \{TransportError\} on failure
   */
  publish(channel: string, data: TransportData): Promise<void>

  /** Register message handler for channel */
  subscribe(channel: string, handler: TransportMessageHandler): Promise<void>

  /** Remove subscription from channel */
  unsubscribe(channel: string): Promise<void>

  /** Register callback for reconnection events */
  onReconnect(callback: () => Promise<void> | void): void
}
