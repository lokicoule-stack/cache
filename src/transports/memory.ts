import { BaseTransport } from '../base-transport'

import type { MessageHandler } from '../transport'

/**
 * In-memory transport for testing
 *
 * Shares channels across all instances.
 */
export class MemoryTransport extends BaseTransport {
  static #channels = new Map<string, Set<MessageHandler>>()

  constructor() {
    super('memory')
  }

  protected doConnect(): Promise<void> {
    // Nothing to do for memory transport
    return Promise.resolve()
  }

  protected doDisconnect(): Promise<void> {
    for (const [channel, handlers] of MemoryTransport.#channels.entries()) {
      const channelHandlers = this.getHandlers(channel)
      if (channelHandlers) {
        for (const handler of channelHandlers) {
          handlers.delete(handler)
        }
      }
      if (handlers.size === 0) {
        MemoryTransport.#channels.delete(channel)
      }
    }

    return Promise.resolve()
  }

  protected doPublish(channel: string, data: Uint8Array): Promise<void> {
    const handlers = MemoryTransport.#channels.get(channel)

    if (handlers && handlers.size > 0) {
      // Async dispatch (non-blocking)
      setImmediate(() => {
        void Promise.allSettled(
          Array.from(handlers).map((handler) => Promise.resolve(handler(data))),
        )
      })
    }

    return Promise.resolve()
  }

  protected doSubscribe(channel: string, handler: MessageHandler): Promise<void> {
    let handlers = MemoryTransport.#channels.get(channel)

    if (!handlers) {
      handlers = new Set()
      MemoryTransport.#channels.set(channel, handlers)
    }

    handlers.add(handler)

    return Promise.resolve()
  }

  protected doUnsubscribe(channel: string): Promise<void> {
    const handlers = MemoryTransport.#channels.get(channel)

    if (handlers) {
      const channelHandlers = this.getHandlers(channel)
      if (channelHandlers) {
        for (const handler of channelHandlers) {
          handlers.delete(handler)
        }
      }

      if (handlers.size === 0) {
        MemoryTransport.#channels.delete(channel)
      }
    }

    return Promise.resolve()
  }
}

export function memory(): MemoryTransport {
  return new MemoryTransport()
}

export function createMemoryTransport(): MemoryTransport {
  return new MemoryTransport()
}
