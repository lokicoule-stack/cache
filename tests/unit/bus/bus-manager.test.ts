import { afterEach, describe, expect, it, vi } from 'vitest'
import { BusManager } from '@/core/bus/bus-manager'
import { BusConfigError } from '@/core/bus/bus-errors'
import { FakeTransport } from '@test/doubles'

describe('BusManager', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let manager: BusManager<any, any>

  afterEach(async () => {
    await manager?.stop().catch(() => {})
  })

  describe('bus instantiation', () => {
    it('creates and caches bus instances lazily', () => {
      manager = new BusManager({
        default: 'main',
        transports: { main: { transport: new FakeTransport(), codec: 'json' } },
      })

      const first = manager.use()
      const second = manager.use()
      const named = manager.use('main')

      expect(first).toBe(second)
      expect(first).toBe(named)
    })

    it('throws BusConfigError when no default and no name specified', () => {
      manager = new BusManager({
        transports: { valid: { transport: new FakeTransport(), codec: 'json' } },
      })

      expect(() => manager.use()).toThrow(BusConfigError)
      expect(() => manager.use()).toThrow('No bus name specified')
    })

    it('throws BusConfigError for unknown transport name', () => {
      manager = new BusManager({
        transports: { valid: { transport: new FakeTransport(), codec: 'json' } },
      })

      expect(() => manager.use('unknown')).toThrow(BusConfigError)
      expect(() => manager.use('unknown')).toThrow("Transport 'unknown' not found")
    })
  })

  describe('lifecycle management', () => {
    it('starts and stops all instantiated buses', async () => {
      const t1 = new FakeTransport()
      const t2 = new FakeTransport()

      manager = new BusManager({
        transports: {
          bus1: { transport: t1, codec: 'json' },
          bus2: { transport: t2, codec: 'json' },
        },
      })

      manager.use('bus1')
      manager.use('bus2')

      await manager.start()
      expect(t1.connected).toBe(true)
      expect(t2.connected).toBe(true)

      await manager.stop()
      expect(t1.connected).toBe(false)
      expect(t2.connected).toBe(false)
    })
  })

  describe('default bus proxy', () => {
    it('proxies pub/sub operations to default bus', async () => {
      manager = new BusManager({
        default: 'main',
        transports: { main: { transport: new FakeTransport(), codec: 'json' } },
      })

      const bus = manager.use()
      await bus.connect()

      const handler = vi.fn()
      await expect(manager.subscribe('ch', handler)).resolves.toBeUndefined()
      await expect(manager.publish('ch', { msg: 'test' })).resolves.toBeUndefined()
      await expect(manager.unsubscribe('ch', handler)).resolves.toBeUndefined()
    })
  })
})
