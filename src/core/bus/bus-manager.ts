import { BusConfigError } from './bus-errors'
import { MessageBus, type BusOptions } from './message-bus'

import type { MessageHandler } from '../../types'
import type {
  Bus,
  BusSchema,
  BusTelemetry,
  ChannelOf,
  DefaultSchema,
  PayloadOf,
} from '@/contracts/bus'

/**
 * Bus manager configuration.
 *
 * @public
 */
export interface BusManagerConfig<Transports extends Record<string, BusOptions>> {
  /** Default transport name */
  default?: keyof Transports

  /** Transport configurations */
  transports: Transports

  /** Global telemetry configuration (can be overridden per transport) */
  telemetry?: BusTelemetry
}

/**
 * Orchestrates multiple buses with type-safe transport names and optional schema.
 *
 * @remarks
 * When a Schema type is provided, all channel names and payload types are
 * validated at compile time across all transports.
 *
 * @example
 * ```typescript
 * // With schema (type-safe)
 * type AppSchema = {
 *   'user:created': { id: string; email: string }
 *   'order:placed': { orderId: string; total: number }
 * }
 *
 * const manager = new BusManager<AppSchema>({
 *   default: 'main',
 *   transports: {
 *     main: { transport: redis() },
 *   },
 * })
 *
 * await manager.publish('user:created', { id: '123', email: 'a@b.com' }) // OK
 * await manager.publish('user:created', { id: 123 }) // TS Error
 *
 * await manager.subscribe('order:placed', (order) => {
 *   console.log(order.total) // number - inferred!
 * })
 * ```
 *
 * @public
 */
export class BusManager<
  Schema extends BusSchema = DefaultSchema,
  Transports extends Record<string, BusOptions> = Record<string, BusOptions>,
> {
  readonly #config: BusManagerConfig<Transports>
  readonly #buses = new Map<keyof Transports, Bus<Schema>>()

  constructor(config: BusManagerConfig<Transports>) {
    this.#config = config
  }

  /**
   * Get or create a bus instance (lazy instantiation).
   *
   * @param name - Transport name (defaults to configured default)
   * @returns Bus instance with schema type safety
   * @throws {BusConfigError} If transport not found
   */
  use<K extends keyof Transports>(name?: K): Bus<Schema> {
    const busName = (name ?? this.#config.default) as keyof Transports

    if (!busName) {
      throw new BusConfigError('No bus name specified and no default configured')
    }

    const cached = this.#buses.get(busName)

    if (cached) {
      return cached
    }

    const busConfig = this.#config.transports[busName]

    if (!busConfig) {
      throw new BusConfigError(`Transport '${String(busName)}' not found`)
    }

    // Merge global telemetry with bus-specific telemetry
    const mergedConfig: BusOptions = {
      ...busConfig,
      telemetry: busConfig.telemetry ?? this.#config.telemetry,
    }

    const bus = new MessageBus<Schema>(mergedConfig)

    this.#buses.set(busName, bus)

    return bus
  }

  /**
   * Start all buses or a specific one.
   *
   * @param name - Optional transport name (starts all if omitted)
   */
  async start<K extends keyof Transports>(name?: K): Promise<void> {
    if (name) {
      await this.use(name).connect()
    } else {
      const busNames = Object.keys(this.#config.transports) as Array<keyof Transports>

      await Promise.all(busNames.map((busName) => this.use(busName).connect()))
    }
  }

  /**
   * Stop all buses or a specific one.
   *
   * @param name - Optional transport name (stops all if omitted)
   */
  async stop<K extends keyof Transports>(name?: K): Promise<void> {
    if (name) {
      await this.use(name).disconnect()
    } else {
      await Promise.all(Array.from(this.#buses.values()).map((b) => b.disconnect()))
      this.#buses.clear()
    }
  }

  /**
   * Publish to the default bus with type-safe payload.
   *
   * @param channel - Channel name (must exist in schema if schema is provided)
   * @param data - Payload data (type inferred from schema)
   */
  async publish<C extends ChannelOf<Schema>>(
    channel: C,
    data: PayloadOf<Schema, C>,
  ): Promise<void> {
    return this.use().publish(channel, data)
  }

  /**
   * Subscribe to the default bus with type-safe handler.
   *
   * @param channel - Channel name (must exist in schema if schema is provided)
   * @param handler - Message handler (receives type from schema)
   */
  async subscribe<C extends ChannelOf<Schema>>(
    channel: C,
    handler: MessageHandler<PayloadOf<Schema, C>>,
  ): Promise<void> {
    return this.use().subscribe(channel, handler)
  }

  /**
   * Unsubscribe from the default bus.
   *
   * @param channel - Channel name
   * @param handler - Optional specific handler to remove
   */
  async unsubscribe<C extends ChannelOf<Schema>>(
    channel: C,
    handler?: MessageHandler<PayloadOf<Schema, C>>,
  ): Promise<void> {
    return this.use().unsubscribe(channel, handler)
  }
}
