import { BusConfigError } from './bus-errors'
import { MessageBus, type BusOptions } from './message-bus'

import type { MessageHandler, Serializable } from '../../types'
import type { Bus } from '@/contracts/bus'

/**
 * Bus manager configuration.
 * @public
 */
export interface BusManagerConfig<T extends Record<string, BusOptions>> {
  /** Default transport name */
  default?: keyof T
  /** Transport configurations */
  transports: T
}

/**
 * Orchestrates multiple buses with type-safe transport names.
 * @public
 */
export class BusManager<T extends Record<string, BusOptions>> {
  #config: BusManagerConfig<T>
  #buses = new Map<keyof T, Bus>()

  constructor(config: BusManagerConfig<T>) {
    this.#config = config
  }

  /** Get or create a bus instance (lazy). @throws {BusConfigError} */
  use<K extends keyof T>(name?: K): Bus {
    const busName = (name ?? this.#config.default) as keyof T

    if (!busName) {
      throw new BusConfigError('No bus name specified and no default configured')
    }

    const cached = this.#buses.get(busName)

    if (cached) {
      return cached
    }

    const config = this.#config.transports[busName]

    if (!config) {
      throw new BusConfigError(`Transport '${String(busName)}' not found`)
    }

    const bus = new MessageBus(config)

    this.#buses.set(busName, bus)

    return bus
  }

  /** Start all buses (or specific one). @throws {BusOperationError} */
  async start<K extends keyof T>(name?: K): Promise<void> {
    if (name) {
      await this.use(name).connect()
    } else {
      await Promise.all(Array.from(this.#buses.values()).map((b) => b.connect()))
    }
  }

  /** Stop all buses (or specific one). @throws {BusOperationError} */
  async stop<K extends keyof T>(name?: K): Promise<void> {
    if (name) {
      await this.use(name).disconnect()
    } else {
      await Promise.all(Array.from(this.#buses.values()).map((b) => b.disconnect()))
      this.#buses.clear()
    }
  }

  /** Publish to default bus. @throws {BusConfigError} @throws {BusOperationError} */
  async publish<D extends Serializable>(channel: string, data: D): Promise<void> {
    return this.use().publish(channel, data)
  }

  /** Subscribe to default bus. @throws {BusConfigError} @throws {BusOperationError} */
  async subscribe<D extends Serializable>(
    channel: string,
    handler: MessageHandler<D>,
  ): Promise<void> {
    return this.use().subscribe(channel, handler)
  }

  /** Unsubscribe from default bus. @throws {BusConfigError} @throws {BusOperationError} */
  async unsubscribe(channel: string, handler?: MessageHandler): Promise<void> {
    return this.use().unsubscribe(channel, handler)
  }
}
