/* eslint-disable @typescript-eslint/no-floating-promises */
/* eslint-disable @typescript-eslint/no-misused-promises */
/* eslint-disable @typescript-eslint/require-await */
import type { Transport } from '@/contracts/transport'
import type { TransportData, TransportMessageHandler } from '@/types'

export interface PublishedMessage {
  channel: string
  data: TransportData
  timestamp: number
}

/**
 * Functional in-memory transport double for testing.
 *
 * Features:
 * - Tracks all published messages for assertions
 * - Supports delivery delay simulation
 * - Provides inspection methods for test verification
 * - Automatic cleanup on disconnect
 */
export class FakeTransport implements Transport {
  readonly name = 'fake'

  private _connected = false
  private handlers = new Map<string, TransportMessageHandler>()
  private published: PublishedMessage[] = []
  private reconnectCallback?: () => void | Promise<void>
  private deliveryDelay = 0

  // ============ Transport Interface ============

  async connect(): Promise<void> {
    this._connected = true
  }

  async disconnect(): Promise<void> {
    this._connected = false
    this.handlers.clear()
  }

  async publish(channel: string, data: TransportData): Promise<void> {
    if (!this._connected) {
      throw new Error('Transport not connected')
    }

    this.published.push({
      channel,
      data,
      timestamp: Date.now(),
    })

    const handler = this.handlers.get(channel)
    if (handler) {
      if (this.deliveryDelay > 0) {
        setTimeout(() => handler(data), this.deliveryDelay)
      } else {
        setImmediate(() => handler(data))
      }
    }
  }

  async subscribe(channel: string, handler: TransportMessageHandler): Promise<void> {
    if (!this._connected) {
      throw new Error('Transport not connected')
    }
    this.handlers.set(channel, handler)
  }

  async unsubscribe(channel: string): Promise<void> {
    this.handlers.delete(channel)
  }

  onReconnect(callback: () => void | Promise<void>): void {
    this.reconnectCallback = callback
  }

  // ============ Test Helpers ============

  /** Check connection state */
  get connected(): boolean {
    return this._connected
  }

  /** Get all published messages */
  getPublishedMessages(): readonly PublishedMessage[] {
    return this.published
  }

  /** Get messages for a specific channel */
  getMessagesFor(channel: string): readonly PublishedMessage[] {
    return this.published.filter((m) => m.channel === channel)
  }

  /** Get the last published message */
  getLastMessage(channel?: string): PublishedMessage | undefined {
    const messages = channel ? this.getMessagesFor(channel) : this.published
    return messages[messages.length - 1]
  }

  /** Get all subscribed channels */
  getSubscriptions(): string[] {
    return Array.from(this.handlers.keys())
  }

  /** Check if subscribed to a channel */
  hasSubscription(channel: string): boolean {
    return this.handlers.has(channel)
  }

  /** Simulate an incoming message (bypasses publish tracking) */
  simulateMessage(channel: string, data: TransportData): void {
    const handler = this.handlers.get(channel)
    if (handler) {
      setImmediate(() => handler(data))
    }
  }

  /** Trigger reconnection callback */
  triggerReconnect(): void {
    this.reconnectCallback?.()
  }

  /** Set artificial delivery delay in ms */
  setDeliveryDelay(ms: number): void {
    this.deliveryDelay = ms
  }

  /** Reset all state (useful between tests) */
  reset(): void {
    this.published = []
    this.handlers.clear()
    this.deliveryDelay = 0
  }

  /** Check if transport is in clean state */
  isClean(): boolean {
    return this.published.length === 0 && this.handlers.size === 0
  }
}
