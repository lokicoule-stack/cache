/* eslint-disable @typescript-eslint/no-misused-promises */
/* eslint-disable @typescript-eslint/require-await */
import type { Transport } from '@/contracts/transport'
import type { TransportData, TransportMessageHandler } from '@/types'

export class FakeTransport implements Transport {
  readonly name = 'fake'
  connected = false

  private handlers = new Map<string, TransportMessageHandler>()
  private publishedMessages: Array<{ channel: string; data: TransportData }> = []

  async connect(): Promise<void> {
    this.connected = true
  }

  async disconnect(): Promise<void> {
    this.connected = false
    this.handlers.clear()
  }

  async publish(channel: string, data: TransportData): Promise<void> {
    if (!this.connected) throw new Error('Transport not connected')

    this.publishedMessages.push({ channel, data })

    const handler = this.handlers.get(channel)
    if (handler) {
      setImmediate(() => handler(data))
    }
  }

  async subscribe(channel: string, handler: TransportMessageHandler): Promise<void> {
    if (!this.connected) throw new Error('Transport not connected')

    this.handlers.set(channel, handler)
  }

  async unsubscribe(channel: string): Promise<void> {
    this.handlers.delete(channel)
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onReconnect(_callback: () => void): void {}

  getPublishedMessages(): ReadonlyArray<{ channel: string; data: TransportData }> {
    return [...this.publishedMessages]
  }
}
