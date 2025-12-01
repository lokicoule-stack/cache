import { Bus, type BusOptions } from './bus'

import type { MessageHandler, Serializable } from './types'

export interface BusManagerConfig<T extends Record<string, BusOptions>> {
  default?: keyof T
  transports: T
}

/**
 * Bus manager - orchestrates multiple buses with type-safe transport names
 */
export class BusManager<T extends Record<string, BusOptions>> {
  #config: BusManagerConfig<T>
  #buses = new Map<keyof T, Bus>()

  constructor(config: BusManagerConfig<T>) {
    this.#config = config
  }

  /**
   * Get or create a bus instance (type-safe)
   */
  use<K extends keyof T>(name?: K): Bus {
    const busName = (name ?? this.#config.default) as keyof T

    if (!busName) {
      throw new Error('No bus name specified and no default configured')
    }

    // Return cached
    const cached = this.#buses.get(busName)
    if (cached) {return cached}

    // Create new
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
   */
  async start<K extends keyof T>(name?: K): Promise<void> {
    if (name) {
      await this.use(name).connect()
    } else {
      // Start all cached buses
      await Promise.all(
        Array.from(this.#buses.values()).map((b) => b.connect()),
      )
    }
  }

  /**
   * Stop all buses (or specific one)
   */
  async stop<K extends keyof T>(name?: K): Promise<void> {
    if (name) {
      await this.use(name).disconnect()
    } else {
      await Promise.all(
        Array.from(this.#buses.values()).map((b) => b.disconnect()),
      )
      this.#buses.clear()
    }
  }

  /**
   * Proxy: publish to default bus
   */
  async publish<D extends Serializable>(channel: string, data: D): Promise<void> {
    return this.use().publish(channel, data)
  }

  /**
   * Proxy: subscribe to default bus
   */
  async subscribe<D extends Serializable>(
    channel: string,
    handler: MessageHandler<D>,
  ): Promise<void> {
    return this.use().subscribe(channel, handler)
  }

  /**
   * Proxy: unsubscribe from default bus
   */
  async unsubscribe(channel: string, handler?: MessageHandler): Promise<void> {
    return this.use().unsubscribe(channel, handler)
  }

  /**
   * Get list of registered transports (type-safe)
   */
  get transports(): (keyof T)[] {
    return Object.keys(this.#config.transports) as (keyof T)[]
  }

  /**
   * Get list of active buses (type-safe)
   */
  get activeBuses(): (keyof T)[] {
    return Array.from(this.#buses.keys())
  }
}
