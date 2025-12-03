import { Bus, type BusOptions } from './bus'

import type { MessageHandler, Serializable } from '../types'

/**
 * Bus manager configuration
 *
 * @template T - Record of transport configurations keyed by name
 * @property default - Default transport name to use when none is specified
 * @property transports - Map of transport names to their bus configurations
 */
export interface BusManagerConfig<T extends Record<string, BusOptions>> {
  default?: keyof T
  transports: T
}

/**
 * Bus manager - orchestrates multiple buses with type-safe transport names
 *
 * Manages multiple bus instances with lazy instantiation and automatic lifecycle.
 * Provides type-safe access to configured transports and proxy methods for
 * working with the default bus.
 *
 * @template T - Record of transport configurations keyed by name
 *
 * @example
 * ```typescript
 * const manager = new BusManager({
 *   default: 'memory',
 *   transports: {
 *     memory: { transport: memory(), codec: 'json' },
 *     redis: { transport: redis({ url: 'redis://localhost' }), codec: 'msgpack' }
 *   }
 * })
 *
 * await manager.start() // Connect all cached buses
 *
 * // Use specific bus
 * await manager.use('redis').publish('events', { type: 'user.created' })
 *
 * // Use default bus
 * await manager.publish('events', { type: 'user.created' })
 *
 * await manager.stop() // Disconnect all buses
 * ```
 */
export class BusManager<T extends Record<string, BusOptions>> {
  #config: BusManagerConfig<T>
  #buses = new Map<keyof T, Bus>()

  /**
   * Create a new BusManager instance
   *
   * @param config - Bus manager configuration with transport definitions
   */
  constructor(config: BusManagerConfig<T>) {
    this.#config = config
  }

  /**
   * Get or create a bus instance (type-safe)
   *
   * Lazy instantiation - buses are only created when first accessed.
   * Subsequent calls return the cached instance.
   *
   * @template K - Transport name key
   * @param name - Transport name (optional, uses default if omitted)
   * @returns Bus instance for the specified transport
   * @throws {Error} If no name specified and no default configured
   * @throws {Error} If transport name not found in configuration
   *
   * @example
   * ```typescript
   * const redisBus = manager.use('redis')
   * const defaultBus = manager.use() // Uses configured default
   * ```
   */
  use<K extends keyof T>(name?: K): Bus {
    const busName = (name ?? this.#config.default) as keyof T

    if (!busName) {
      throw new Error('No bus name specified and no default configured')
    }

    const cached = this.#buses.get(busName)
    if (cached) {
      return cached
    }

    const config = this.#config.transports[busName]
    if (!config) {
      throw new Error(`Transport '${String(busName)}' not found`)
    }

    const bus = new Bus(config)
    this.#buses.set(busName, bus)
    return bus
  }

  /**
   * Start all buses (or specific one)
   *
   * Connects the transport(s). Only affects buses that have been instantiated
   * via use(). If a name is provided, only that bus is started.
   *
   * @template K - Transport name key
   * @param name - Transport name (optional, starts all if omitted)
   * @returns Promise that resolves when all buses are connected
   * @throws {BusOperationError} If connection fails
   *
   * @example
   * ```typescript
   * await manager.start() // Start all cached buses
   * await manager.start('redis') // Start only redis bus
   * ```
   */
  async start<K extends keyof T>(name?: K): Promise<void> {
    if (name) {
      await this.use(name).connect()
    } else {
      await Promise.all(Array.from(this.#buses.values()).map((b) => b.connect()))
    }
  }

  /**
   * Stop all buses (or specific one)
   *
   * Disconnects the transport(s) and clears the cache. If a name is provided,
   * only that bus is stopped.
   *
   * @template K - Transport name key
   * @param name - Transport name (optional, stops all if omitted)
   * @returns Promise that resolves when all buses are disconnected
   * @throws {BusOperationError} If disconnection fails
   *
   * @example
   * ```typescript
   * await manager.stop() // Stop all buses
   * await manager.stop('redis') // Stop only redis bus
   * ```
   */
  async stop<K extends keyof T>(name?: K): Promise<void> {
    if (name) {
      await this.use(name).disconnect()
    } else {
      await Promise.all(Array.from(this.#buses.values()).map((b) => b.disconnect()))
      this.#buses.clear()
    }
  }

  /**
   * Publish a message to the default bus
   *
   * Convenience method that proxies to the default bus instance.
   *
   * @template D - Message data type (must extend Serializable)
   * @param channel - The channel name to publish to
   * @param data - The message data to publish
   * @returns Promise that resolves when message is published
   * @throws {Error} If no default bus configured
   * @throws {BusOperationError} If publish operation fails
   *
   * @example
   * ```typescript
   * await manager.publish('events', { type: 'user.created' })
   * ```
   */
  async publish<D extends Serializable>(channel: string, data: D): Promise<void> {
    return this.use().publish(channel, data)
  }

  /**
   * Subscribe to a channel on the default bus
   *
   * Convenience method that proxies to the default bus instance.
   *
   * @template D - Expected message data type (must extend Serializable)
   * @param channel - The channel name to subscribe to
   * @param handler - Function to handle incoming messages
   * @returns Promise that resolves when subscription is active
   * @throws {Error} If no default bus configured
   * @throws {BusOperationError} If subscription fails
   *
   * @example
   * ```typescript
   * await manager.subscribe<UserEvent>('events', (data) => {
   *   console.log('Event:', data)
   * })
   * ```
   */
  async subscribe<D extends Serializable>(
    channel: string,
    handler: MessageHandler<D>,
  ): Promise<void> {
    return this.use().subscribe(channel, handler)
  }

  /**
   * Unsubscribe from a channel on the default bus
   *
   * Convenience method that proxies to the default bus instance.
   *
   * @param channel - The channel name to unsubscribe from
   * @param handler - Specific handler to remove (optional, removes all if omitted)
   * @returns Promise that resolves when unsubscription is complete
   * @throws {Error} If no default bus configured
   * @throws {BusOperationError} If unsubscription fails
   *
   * @example
   * ```typescript
   * await manager.unsubscribe('events', myHandler)
   * await manager.unsubscribe('events') // Remove all handlers
   * ```
   */
  async unsubscribe(channel: string, handler?: MessageHandler): Promise<void> {
    return this.use().unsubscribe(channel, handler)
  }

  /**
   * Get list of registered transport names
   *
   * Returns all transport names from the configuration,
   * regardless of whether they have been instantiated.
   *
   * @example
   * ```typescript
   * console.log(manager.transports) // ['memory', 'redis']
   * ```
   */
  get transports(): (keyof T)[] {
    return Object.keys(this.#config.transports) as (keyof T)[]
  }

  /**
   * Get list of active bus names
   *
   * Returns only the transport names that have been instantiated
   * (via use()). Useful for monitoring which buses are cached.
   *
   * @example
   * ```typescript
   * console.log(manager.activeBuses) // ['memory'] - only if used
   * ```
   */
  get activeBuses(): (keyof T)[] {
    return Array.from(this.#buses.keys())
  }
}
