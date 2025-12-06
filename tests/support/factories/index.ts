/**
 * Test factories - FAANG grade
 *
 * Centralized place for creating test instances
 * Ensures consistent setup across all tests
 */

import { MessageBus, type BusOptions } from '@/core/bus/message-bus'
import { BusManager, type BusManagerConfig } from '@/core/bus/bus-manager'
import { MemoryTransport } from '@/infrastructure/transports/memory/memory-transport'
import { FakeTransport, SpyTransport } from '../doubles/transports'
import type { Transport } from '@/contracts/transport'
import type { CodecOption } from '@/contracts/codec'

/**
 * Create a message bus with sensible test defaults
 */
export function createBus(options: Partial<BusOptions> = {}): MessageBus {
  return new MessageBus({
    transport: options.transport ?? new FakeTransport(),
    codec: options.codec ?? 'json',
    middleware: options.middleware,
    onHandlerError: options.onHandlerError,
  })
}

/**
 * Create and connect a bus (most common case)
 */
export async function createConnectedBus(options: Partial<BusOptions> = {}): Promise<MessageBus> {
  const bus = createBus(options)
  await bus.connect()
  return bus
}

/**
 * Create bus with spy transport for verification
 */
export function createSpyBus(baseTransport?: Transport): { bus: MessageBus; spy: SpyTransport } {
  const spy = new SpyTransport(baseTransport ?? new FakeTransport())
  const bus = createBus({ transport: spy })

  return { bus, spy }
}

/**
 * Create bus manager for multi-bus tests
 */
export function createBusManager<
  T extends Record<string, { transport: Transport; codec?: CodecOption }>,
>(config: BusManagerConfig<T>): BusManager<T> {
  return new BusManager(config)
}

/**
 * Create pair of connected buses for cross-bus communication tests
 */
export async function createBusPair(options?: {
  codec?: CodecOption
  transport?: 'memory' | 'fake'
}): Promise<[MessageBus, MessageBus]> {
  const transportType = options?.transport ?? 'fake'
  const codec = options?.codec ?? 'json'

  const createTransport = () =>
    transportType === 'memory' ? new MemoryTransport() : new FakeTransport()

  const bus1 = createBus({ transport: createTransport(), codec })
  const bus2 = createBus({ transport: createTransport(), codec })

  await Promise.all([bus1.connect(), bus2.connect()])

  return [bus1, bus2]
}

/**
 * Create multiple buses for scalability tests
 */
export async function createBusArray(
  count: number,
  options?: Partial<BusOptions>,
): Promise<MessageBus[]> {
  const buses = Array.from({ length: count }, () => createBus(options))
  await Promise.all(buses.map((bus) => bus.connect()))
  return buses
}

/**
 * Cleanup utilities
 */
export async function cleanupBus(bus: MessageBus): Promise<void> {
  try {
    await bus.disconnect()
  } catch {
    // Ignore cleanup errors
  }
}

export async function cleanupBuses(...buses: MessageBus[]): Promise<void> {
  await Promise.all(buses.map(cleanupBus))
}

/**
 * Test lifecycle helper
 */
export class BusTestContext {
  private buses: MessageBus[] = []

  /**
   * Create and track a bus for automatic cleanup
   */
  async createBus(options?: Partial<BusOptions>): Promise<MessageBus> {
    const bus = await createConnectedBus(options)
    this.buses.push(bus)
    return bus
  }

  /**
   * Create bus without connecting (for error testing)
   */
  createBusWithoutConnect(options?: Partial<BusOptions>): MessageBus {
    const bus = createBus(options)
    this.buses.push(bus)
    return bus
  }

  /**
   * Create multiple buses
   */
  async createBuses(count: number, options?: Partial<BusOptions>): Promise<MessageBus[]> {
    const buses = await createBusArray(count, options)
    this.buses.push(...buses)
    return buses
  }

  /**
   * Cleanup all buses created in this context
   */
  async cleanup(): Promise<void> {
    await cleanupBuses(...this.buses)
    this.buses = []
  }
}

/**
 * Create test context for automatic cleanup
 */
export function createTestContext(): BusTestContext {
  return new BusTestContext()
}
