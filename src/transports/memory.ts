import type { ITransport, TransportData, TransportMessageHandler } from '../types'

/**
 * In-memory transport with instance-based isolation
 */
export class MemoryTransport implements ITransport {
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
        setImmediate(() => handler(data))
      }
    }
  }

  async subscribe(channel: string, handler: TransportMessageHandler): Promise<void> {
    if (!this.#channels.has(channel)) {
      this.#channels.set(channel, new Set())
    }

    const handlers = this.#channels.get(channel)
    if (handlers) {
      handlers.add(handler)
    }
  }

  async unsubscribe(channel: string): Promise<void> {
    this.#channels.delete(channel)
  }
}

export function memory(): MemoryTransport {
  return new MemoryTransport()
}
