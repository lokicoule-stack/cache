import type { Transport } from '@/contracts/transport'
import type { TransportData, TransportMessageHandler } from '@/types'

/**
 * In-memory transport for local/testing use
 *
 * Provides a lightweight, zero-dependency transport that stores subscriptions
 * in memory. Messages are delivered synchronously within the same process.
 * No external services required - perfect for unit tests, development, and
 * single-process applications.
 *
 * Characteristics:
 * - Zero latency (same-process delivery)
 * - No persistence (messages lost on restart)
 * - No network overhead
 * - Thread-safe within a single Node.js process
 *
 * Use cases:
 * - Unit and integration testing
 * - Local development without Redis
 * - Simple single-process applications
 * - Prototyping and demos
 *
 * @example
 * ```typescript
 * import { memory } from '@lokiverse/bus'
 *
 * const transport = memory()
 * const bus = new Bus({ transport })
 *
 * await bus.connect()
 * await bus.subscribe('events', (data) => console.log(data))
 * await bus.publish('events', { type: 'test' })
 * ```
 */
export class MemoryTransport implements Transport {
  readonly name = 'memory'

  #channels = new Map<string, Set<TransportMessageHandler>>()

  /**
   * Connect the memory transport
   *
   * No-op for memory transport as it's always ready. Included for
   * Transport interface compliance.
   *
   * @returns Promise that resolves immediately
   */
  async connect(): Promise<void> {
    // No-op: memory transport requires no connection setup
  }

  /**
   * Disconnect the memory transport
   *
   * Clears all active subscriptions and handlers. Messages published
   * after disconnect will not be delivered.
   *
   * @returns Promise that resolves when cleanup is complete
   */
  async disconnect(): Promise<void> {
    this.#channels.clear()
  }

  /**
   * Publish a message to a channel
   *
   * Delivers the message synchronously to all registered handlers for
   * the channel. Handlers are invoked in registration order. Handler
   * errors are caught and swallowed to prevent cascading failures.
   *
   * @param channel - The channel name to publish to
   * @param data - The binary message data
   * @returns Promise that resolves when message is delivered to all handlers
   */
  async publish(channel: string, data: TransportData): Promise<void> {
    const handlers = this.#channels.get(channel)
    if (handlers) {
      for (const handler of handlers) {
        Promise.resolve(handler(data)).catch(() => {})
      }
    }
  }

  /**
   * Subscribe to a channel
   *
   * Registers a handler to receive messages from the channel. Multiple
   * handlers can subscribe to the same channel. The channel is created
   * automatically if it doesn't exist.
   *
   * @param channel - The channel name to subscribe to
   * @param handler - Function to handle incoming messages
   * @returns Promise that resolves when subscription is active
   */
  async subscribe(channel: string, handler: TransportMessageHandler): Promise<void> {
    if (!this.#channels.has(channel)) {
      this.#channels.set(channel, new Set())
    }
    this.#channels.get(channel)?.add(handler)
  }

  /**
   * Unsubscribe from a channel
   *
   * Removes all handlers from the channel and deletes the channel.
   * Messages published to this channel after unsubscribe will be ignored.
   *
   * @param channel - The channel name to unsubscribe from
   * @returns Promise that resolves when unsubscription is complete
   */
  async unsubscribe(channel: string): Promise<void> {
    this.#channels.delete(channel)
  }
}

/**
 * Factory function for creating memory transport
 *
 * Convenience function that instantiates a MemoryTransport.
 * Provides a clean, functional API consistent with other transports.
 *
 * @returns New MemoryTransport instance
 *
 * @example
 * ```typescript
 * const transport = memory()
 * const bus = new Bus({ transport, codec: 'json' })
 * ```
 */
export function memory(): MemoryTransport {
  return new MemoryTransport()
}
