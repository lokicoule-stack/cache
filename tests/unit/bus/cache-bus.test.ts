/* eslint-disable @typescript-eslint/no-unsafe-function-type */
/* eslint-disable @typescript-eslint/require-await */
import { describe, it, expect, vi } from 'vitest'

import { createCacheBus, type CacheBusSchema } from '@/bus/cache-bus'
import type { Bus } from '@lokiverse/bus'

function createFakeBus(): Bus<CacheBusSchema> & { handlers: Map<string, Function> } {
  const handlers = new Map<string, Function>()

  return {
    handlers,
    async connect() {},
    async disconnect() {},
    async subscribe<C extends keyof CacheBusSchema>(
      channel: C,
      handler: (data: CacheBusSchema[C]) => void,
    ) {
      handlers.set(channel as string, handler)
    },
    async unsubscribe(channel: keyof CacheBusSchema) {
      handlers.delete(channel as string)
    },
    async publish() {
      // In real bus, this would broadcast to other instances
    },
  }
}

describe('createCacheBus', () => {
  it('subscribes to invalidate events on connect', async () => {
    const bus = createFakeBus()
    const onInvalidate = vi.fn()
    const cacheBus = createCacheBus({
      bus,
      onInvalidate,
      onInvalidateTags: vi.fn(),
      onClear: vi.fn(),
    })

    await cacheBus.connect()

    expect(bus.handlers.has('cache:invalidate')).toBe(true)
  })

  it('calls onInvalidate when invalidate event received', async () => {
    const bus = createFakeBus()
    const onInvalidate = vi.fn()
    const cacheBus = createCacheBus({
      bus,
      onInvalidate,
      onInvalidateTags: vi.fn(),
      onClear: vi.fn(),
    })

    await cacheBus.connect()
    bus.handlers.get('cache:invalidate')?.({ keys: ['key1', 'key2'] })

    expect(onInvalidate).toHaveBeenCalledWith(['key1', 'key2'])
  })

  it('calls onClear when clear event received', async () => {
    const bus = createFakeBus()
    const onClear = vi.fn()
    const cacheBus = createCacheBus({
      bus,
      onInvalidate: vi.fn(),
      onInvalidateTags: vi.fn(),
      onClear,
    })

    await cacheBus.connect()
    bus.handlers.get('cache:clear')?.({})

    expect(onClear).toHaveBeenCalled()
  })

  it('unsubscribes on disconnect', async () => {
    const bus = createFakeBus()
    const cacheBus = createCacheBus({
      bus,
      onInvalidate: vi.fn(),
      onInvalidateTags: vi.fn(),
      onClear: vi.fn(),
    })

    await cacheBus.connect()
    await cacheBus.disconnect()

    expect(bus.handlers.size).toBe(0)
  })
})
