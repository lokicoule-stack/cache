import type { Transport } from '@/contracts/transport'
import type { TransportData, TransportMessageHandler } from '@/types'

/** @public */
export class MemoryTransport implements Transport {
  readonly name = 'memory'

  #channels = new Map<string, Set<TransportMessageHandler>>()

  async connect(): Promise<void> {}

  async disconnect(): Promise<void> {
    this.#channels.clear()
  }

  async publish(channel: string, data: TransportData): Promise<void> {
    const handlers = this.#channels.get(channel)

    if (handlers) {
      for (const handler of handlers) {
        Promise.resolve(handler(data)).catch(() => {})
      }
    }
  }

  async subscribe(channel: string, handler: TransportMessageHandler): Promise<void> {
    if (!this.#channels.has(channel)) {
      this.#channels.set(channel, new Set())
    }
    this.#channels.get(channel)?.add(handler)
  }

  async unsubscribe(channel: string): Promise<void> {
    this.#channels.delete(channel)
  }

  onReconnect(_callback: () => void): void {
    // No-op: MemoryTransport doesn't have reconnection
  }
}

/** @public */
export function memory(): MemoryTransport {
  return new MemoryTransport()
}
