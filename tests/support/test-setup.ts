import { afterEach } from 'vitest'
import { vi } from 'vitest'
import type { MessageBus } from '@/core/bus/message-bus'
import type { BusOptions } from '@/core/bus/message-bus'
import { createTestContext } from './factories'

export function setupBusTest() {
  const ctx = createTestContext()

  afterEach(() => ctx.cleanup())

  async function createBus(
    options?: Partial<BusOptions> & { skipConnect?: boolean },
  ): Promise<{ bus: MessageBus; handler: ReturnType<typeof vi.fn> }> {
    const { skipConnect, ...busOptions } = options ?? {}
    const bus = skipConnect ? ctx.createBusWithoutConnect(busOptions) : await ctx.createBus(busOptions)
    const handler = vi.fn()
    return { bus, handler }
  }

  return { createBus, cleanup: () => ctx.cleanup() }
}

export function setupMultiBusTest() {
  const ctx = createTestContext()

  afterEach(() => ctx.cleanup())

  async function createBuses(count: number, options?: Partial<BusOptions>): Promise<MessageBus[]> {
    return ctx.createBuses(count, options)
  }

  return { createBuses, cleanup: () => ctx.cleanup() }
}

export function setupIntegrationTest() {
  const ctx = createTestContext()
  const cleanupFns: Array<() => void | Promise<void>> = []

  afterEach(async () => {
    await ctx.cleanup()
    // eslint-disable-next-line @typescript-eslint/await-thenable
    await Promise.all(cleanupFns.map((fn) => fn()))
    cleanupFns.length = 0
  })

  function addCleanup(fn: () => void | Promise<void>): void {
    cleanupFns.push(fn)
  }

  return {
    createBus: (options?: Partial<BusOptions>) => ctx.createBus(options),
    addCleanup,
    cleanup: () => ctx.cleanup(),
  }
}
