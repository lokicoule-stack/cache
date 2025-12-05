import { createClient } from 'redis'

import {
  TransportConnectionError,
  TransportNotReadyError,
  TransportPublishError,
  TransportSubscribeError,
} from '../transport-errors'

import type { RedisTransportConfig } from './redis-transport-config'
import type { Transport } from '@/contracts/transport'
import type { TransportData, TransportMessageHandler } from '@/types'

/**
 * Redis Pub/Sub transport implementation
 *
 * Production-ready transport backed by Redis Pub/Sub. Enables distributed
 * messaging across multiple processes and servers. Requires a running Redis
 * instance (v5.0+).
 *
 * Characteristics:
 * - Distributed (cross-process, cross-server messaging)
 * - Low latency (sub-millisecond typical)
 * - Fire-and-forget (no message persistence by default)
 * - Horizontal scalability (add more subscribers/publishers)
 * - Requires external Redis service
 *
 * Architecture:
 * - Uses two Redis connections: one for publishing, one for subscribing
 * - Subscriber connection uses Redis v5 Buffer mode for binary data
 * - Publisher connection sends binary data via Buffer conversion
 * - Multiple handlers per channel supported via internal tracking
 *
 * Use cases:
 * - Microservices communication
 * - Event-driven architectures
 * - Real-time notifications
 * - Distributed task queues
 *
 * @example
 * ```typescript
 * import { redis } from '@lokiverse/bus'
 *
 * const transport = redis({
 *   socket: { host: 'localhost', port: 6379 },
 *   password: process.env.REDIS_PASSWORD,
 * })
 *
 * const bus = new Bus({ transport })
 * await bus.connect()
 * ```
 *
 * @see {@link https://redis.io/docs/interact/pubsub/ | Redis Pub/Sub Documentation}
 */
export class RedisTransport implements Transport {
  readonly name = 'redis'

  #publisher?: ReturnType<typeof createClient>
  #subscriber?: ReturnType<typeof createClient>
  #config: RedisTransportConfig
  #subscriptions = new Map<string, Set<TransportMessageHandler>>()

  /**
   * Create a new RedisTransport instance
   *
   * @param config - Redis client configuration (optional, defaults to localhost:6379)
   */
  constructor(config: RedisTransportConfig = {}) {
    this.#config = config
  }

  /**
   * Connect to Redis
   *
   * Establishes two Redis connections: one for publishing, one for subscribing.
   * The subscriber is a duplicate of the publisher to avoid command conflicts.
   * Both connections must succeed for connect() to resolve.
   *
   * @returns Promise that resolves when both connections are established
   * @throws {TransportConnectionError} If connection fails (network, auth, etc.)
   */
  async connect(): Promise<void> {
    try {
      this.#publisher = createClient(this.#config)
      this.#subscriber = this.#publisher.duplicate()

      await Promise.all([this.#publisher.connect(), this.#subscriber.connect()])
    } catch (error) {
      throw new TransportConnectionError(this.name, error as Error)
    }
  }

  /**
   * Disconnect from Redis
   *
   * Gracefully closes both Redis connections using quit() command.
   * Clears all internal subscription tracking. Subsequent operations
   * will fail until reconnect.
   *
   * @returns Promise that resolves when both connections are closed
   * @throws {TransportConnectionError} If disconnection fails
   */
  async disconnect(): Promise<void> {
    try {
      await Promise.all([this.#publisher?.quit(), this.#subscriber?.quit()])

      this.#publisher = undefined
      this.#subscriber = undefined
      this.#subscriptions.clear()
    } catch (error) {
      throw new TransportConnectionError(this.name, error as Error)
    }
  }

  /**
   * Publish a message to a Redis channel
   *
   * Sends binary data to all subscribers of the channel across all connected
   * processes. Converts Uint8Array to Buffer for Redis compatibility.
   *
   * @param channel - The channel name to publish to
   * @param data - The binary message data
   * @returns Promise that resolves when Redis confirms publish
   * @throws {TransportNotReadyError} If publisher is not connected
   * @throws {TransportPublishError} If Redis publish command fails
   */
  async publish(channel: string, data: TransportData): Promise<void> {
    if (!this.#publisher?.isReady) {
      throw new TransportNotReadyError(this.name, 'publish')
    }

    try {
      await this.#publisher.publish(channel, Buffer.from(data))
    } catch (error) {
      throw new TransportPublishError(this.name, channel, error as Error)
    }
  }

  /**
   * Subscribe to a Redis channel
   *
   * Registers a handler to receive messages from Redis Pub/Sub. On first
   * subscription to a channel, establishes Redis subscription. Subsequent
   * handlers for the same channel reuse the same Redis subscription.
   *
   * Messages are converted from Buffer to Uint8Array before handler invocation.
   * Handler errors are caught to prevent Redis connection disruption.
   *
   * @param channel - The channel name to subscribe to
   * @param handler - Function to handle incoming messages
   * @returns Promise that resolves when Redis subscription is active
   * @throws {TransportNotReadyError} If subscriber is not connected
   * @throws {TransportSubscribeError} If Redis subscribe command fails
   */
  async subscribe(channel: string, handler: TransportMessageHandler): Promise<void> {
    if (!this.#subscriber?.isReady) {
      throw new TransportNotReadyError(this.name, 'subscribe')
    }

    if (!this.#subscriptions.has(channel)) {
      this.#subscriptions.set(channel, new Set())

      try {
        await this.#subscriber.subscribe(channel, (message) => {
          const data = new Uint8Array(Buffer.from(message))

          const handlers = this.#subscriptions.get(channel)

          if (handlers) {
            for (const h of handlers) {
              Promise.resolve(h(data)).catch(() => {})
            }
          }
        })
      } catch (error) {
        this.#subscriptions.delete(channel)
        throw new TransportSubscribeError(this.name, channel, error as Error)
      }
    }

    this.#subscriptions.get(channel)?.add(handler)
  }

  /**
   * Unsubscribe from a Redis channel
   *
   * Removes the Redis subscription for the channel and clears all
   * internal handler tracking. No more messages will be received
   * from this channel until resubscribe.
   *
   * @param channel - The channel name to unsubscribe from
   * @returns Promise that resolves when Redis unsubscribe completes
   * @throws {TransportNotReadyError} If subscriber is not connected
   * @throws {TransportSubscribeError} If Redis unsubscribe command fails
   */
  async unsubscribe(channel: string): Promise<void> {
    if (!this.#subscriber?.isReady) {
      throw new TransportNotReadyError(this.name, 'unsubscribe')
    }

    try {
      await this.#subscriber.unsubscribe(channel)
      this.#subscriptions.delete(channel)
    } catch (error) {
      throw new TransportSubscribeError(this.name, channel, error as Error)
    }
  }
}

/**
 * Factory function for creating Redis transport
 *
 * Convenience function that instantiates a RedisTransport with the
 * provided configuration. Defaults to localhost:6379 if no config given.
 *
 * @param config - Redis client configuration (optional)
 * @returns New RedisTransport instance
 *
 * @example
 * ```typescript
 * // Local Redis
 * const transport = redis()
 *
 * // Remote Redis with auth
 * const transport = redis({
 *   socket: { host: 'redis.example.com', port: 6379 },
 *   password: process.env.REDIS_PASSWORD,
 * })
 * ```
 */
export function redis(config?: RedisTransportConfig): RedisTransport {
  return new RedisTransport(config)
}
