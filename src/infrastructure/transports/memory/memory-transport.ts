import type { Transport } from '@/contracts/transport'
import type { TransportData, TransportMessageHandler } from '@/types'

/** @public */
export class MemoryTransport implements Transport {
  readonly name = 'memory'

  #handlers = new Map<string, TransportMessageHandler>()

  async connect(): Promise<void> {}

  async disconnect(): Promise<void> {
    this.#handlers.clear()
  }

  async publish(channel: string, data: TransportData): Promise<void> {
    const handler = this.#handlers.get(channel)

    if (handler) {
      Promise.resolve(handler(data)).catch(() => {})
    }
  }

  async subscribe(channel: string, handler: TransportMessageHandler): Promise<void> {
    this.#handlers.set(channel, handler)
  }

  async unsubscribe(channel: string): Promise<void> {
    this.#handlers.delete(channel)
  }

  onReconnect(_callback: () => void): void {
    // No-op: MemoryTransport doesn't have reconnection
  }
}

/** @public */
export function memory(): MemoryTransport {
  return new MemoryTransport()
}
