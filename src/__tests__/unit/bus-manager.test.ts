import { beforeEach, describe, expect, it, vi } from 'vitest'

import { MockTransport, setupTestEnvironment, waitFor } from '../utils/test-helpers'

import { BusManager } from '@/core/bus/bus-manager'

setupTestEnvironment()

describe('BusManager', () => {
  let transport1: MockTransport
  let transport2: MockTransport
  let manager: BusManager<{
    primary: { transport: MockTransport; codec: 'json' }
    secondary: { transport: MockTransport; codec: 'msgpack' }
  }>

  beforeEach(() => {
    transport1 = new MockTransport()
    transport2 = new MockTransport()
    manager = new BusManager({
      default: 'primary',
      transports: {
        primary: { transport: transport1, codec: 'json' },
        secondary: { transport: transport2, codec: 'msgpack' },
      },
    })
  })

  describe('constructor', () => {
    it('should create manager with default transport', () => {
      expect(manager).toBeInstanceOf(BusManager)
      expect(manager.transports).toContain('primary')
      expect(manager.transports).toContain('secondary')
    })

    it('should create manager without default transport', () => {
      const noDefaultManager = new BusManager({
        transports: {
          primary: { transport: transport1, codec: 'json' },
        },
      })
      expect(noDefaultManager).toBeInstanceOf(BusManager)
    })
  })

  describe('use', () => {
    it('should return default bus when no name specified', () => {
      const bus = manager.use()
      expect(bus).toBeDefined()
    })

    it('should return named bus', () => {
      const bus = manager.use('primary')
      expect(bus).toBeDefined()
    })

    it('should cache bus instances', () => {
      const bus1 = manager.use('primary')
      const bus2 = manager.use('primary')
      expect(bus1).toBe(bus2)
    })

    it('should throw when no name and no default', () => {
      const noDefaultManager = new BusManager({
        transports: {
          primary: { transport: transport1, codec: 'json' },
        },
      })
      expect(() => noDefaultManager.use()).toThrow(
        'No bus name specified and no default configured',
      )
    })

    it('should throw when transport not found', () => {
      expect(() => manager.use('nonexistent' as never)).toThrow("Transport 'nonexistent' not found")
    })

    it('should create separate instances for different transports', () => {
      const bus1 = manager.use('primary')
      const bus2 = manager.use('secondary')
      expect(bus1).not.toBe(bus2)
    })
  })

  describe('start', () => {
    it('should start default bus', async () => {
      await manager.start()
      const bus = manager.use('primary')
      await expect(bus.connect()).resolves.not.toThrow()
    })

    it('should start specific bus', async () => {
      await manager.start('secondary')
      expect(transport2.connected).toBe(true)
    })

    it('should start all cached buses when no name specified', async () => {
      manager.use('primary')
      manager.use('secondary')
      await manager.start()
      expect(transport1.connected).toBe(true)
      expect(transport2.connected).toBe(true)
    })

    it('should handle start failures', async () => {
      transport1.shouldFailConnect = true
      await expect(manager.start('primary')).rejects.toThrow('Mock connect failed')
    })

    it('should start only cached buses, not all configured', async () => {
      manager.use('primary')
      await manager.start()
      expect(transport1.connected).toBe(true)
      expect(transport2.connected).toBe(false)
    })
  })

  describe('stop', () => {
    beforeEach(async () => {
      manager.use('primary')
      manager.use('secondary')
      await manager.start()
    })

    it('should stop specific bus', async () => {
      await manager.stop('primary')
      expect(transport1.connected).toBe(false)
      expect(transport2.connected).toBe(true)
    })

    it('should stop all buses when no name specified', async () => {
      await manager.stop()
      expect(transport1.connected).toBe(false)
      expect(transport2.connected).toBe(false)
    })

    it('should clear buses after stop all', async () => {
      expect(manager.activeBuses).toHaveLength(2)
      await manager.stop()
      expect(manager.activeBuses).toHaveLength(0)
    })

    it('should handle stop failures', async () => {
      transport1.shouldFailDisconnect = true
      await expect(manager.stop('primary')).rejects.toThrow('Mock disconnect failed')
    })
  })

  describe('proxy methods', () => {
    beforeEach(async () => {
      await manager.start('primary')
    })

    it('should proxy publish to default bus', async () => {
      await manager.publish('test', 'hello')
      expect(transport1.publishedMessages).toHaveLength(1)
      expect(transport1.publishedMessages[0].channel).toBe('test')
    })

    it('should proxy subscribe to default bus', async () => {
      const handler = vi.fn()
      await manager.subscribe('test', handler)
      await manager.publish('test', 'hello')
      await waitFor(() => handler.mock.calls.length > 0)
      expect(handler).toHaveBeenCalledWith('hello')
    })

    it('should proxy unsubscribe to default bus', async () => {
      const handler = vi.fn()
      await manager.subscribe('test', handler)
      await manager.unsubscribe('test', handler)
      const bus = manager.use('primary')
      expect(bus.channels).toEqual([])
    })

    it('should use default bus for proxy methods', async () => {
      await manager.publish('test', 'hello')
      expect(transport1.publishedMessages).toHaveLength(1)
      expect(transport2.publishedMessages).toHaveLength(0)
    })
  })

  describe('transports property', () => {
    it('should return all configured transport names', () => {
      expect(manager.transports).toContain('primary')
      expect(manager.transports).toContain('secondary')
      expect(manager.transports).toHaveLength(2)
    })

    it('should be type-safe', () => {
      const transports: ('primary' | 'secondary')[] = manager.transports
      expect(transports).toBeDefined()
    })
  })

  describe('activeBuses property', () => {
    it('should return empty array initially', () => {
      expect(manager.activeBuses).toEqual([])
    })

    it('should return active bus names', () => {
      manager.use('primary')
      expect(manager.activeBuses).toEqual(['primary'])
    })

    it('should return all active buses', () => {
      manager.use('primary')
      manager.use('secondary')
      expect(manager.activeBuses).toContain('primary')
      expect(manager.activeBuses).toContain('secondary')
      expect(manager.activeBuses).toHaveLength(2)
    })

    it('should update after stop all', async () => {
      manager.use('primary')
      manager.use('secondary')
      await manager.start()
      await manager.stop()
      expect(manager.activeBuses).toEqual([])
    })
  })

  describe('multi-bus scenarios', () => {
    beforeEach(async () => {
      await manager.start('primary')
      await manager.start('secondary')
    })

    it('should isolate publishes between buses', async () => {
      const primaryBus = manager.use('primary')
      const secondaryBus = manager.use('secondary')

      await primaryBus.publish('test', 'primary-msg')
      await secondaryBus.publish('test', 'secondary-msg')

      expect(transport1.publishedMessages).toHaveLength(1)
      expect(transport2.publishedMessages).toHaveLength(1)
    })

    it('should isolate subscriptions between buses', async () => {
      const handler1 = vi.fn()
      const handler2 = vi.fn()

      const primaryBus = manager.use('primary')
      const secondaryBus = manager.use('secondary')

      await primaryBus.subscribe('test', handler1)
      await secondaryBus.subscribe('test', handler2)

      await primaryBus.publish('test', 'hello')
      await waitFor(() => handler1.mock.calls.length > 0)

      expect(handler1).toHaveBeenCalledWith('hello')
      expect(handler2).not.toHaveBeenCalled()
    })

    it('should allow same channel name on different buses', async () => {
      const primaryHandler = vi.fn()
      const secondaryHandler = vi.fn()

      const primaryBus = manager.use('primary')
      const secondaryBus = manager.use('secondary')

      await primaryBus.subscribe('shared', primaryHandler)
      await secondaryBus.subscribe('shared', secondaryHandler)

      await primaryBus.publish('shared', 'primary-data')
      await secondaryBus.publish('shared', 'secondary-data')

      await waitFor(
        () => primaryHandler.mock.calls.length > 0 && secondaryHandler.mock.calls.length > 0,
      )

      expect(primaryHandler).toHaveBeenCalledWith('primary-data')
      expect(secondaryHandler).toHaveBeenCalledWith('secondary-data')
    })
  })

  describe('lifecycle management', () => {
    it('should handle start/stop cycles', async () => {
      for (let i = 0; i < 3; i++) {
        await manager.start('primary')
        expect(transport1.connected).toBe(true)
        await manager.stop('primary')
        expect(transport1.connected).toBe(false)
      }
    })

    it('should maintain state across restarts', async () => {
      const handler = vi.fn()
      const bus = manager.use('primary')

      await manager.start('primary')
      await bus.subscribe('test', handler)
      await manager.stop('primary')

      transport1.reset()

      // Re-create the bus after stop (which clears the cache)
      const bus2 = manager.use('primary')
      await bus2.subscribe('test', handler)
      await manager.start('primary')
      await bus2.publish('test', 'hello')

      await waitFor(() => handler.mock.calls.length > 0)
      expect(handler).toHaveBeenCalledWith('hello')
    })
  })

  describe('type safety', () => {
    it('should enforce type-safe transport names in use()', () => {
      manager.use('primary')
      manager.use('secondary')
    })

    it('should enforce type-safe transport names in start()', async () => {
      await manager.start('primary')
      await manager.start('secondary')
    })

    it('should enforce type-safe transport names in stop()', async () => {
      await manager.start('primary')
      await manager.stop('primary')
    })
  })

  describe('error scenarios', () => {
    it('should handle partial start failures', async () => {
      manager.use('primary')
      manager.use('secondary')
      transport2.shouldFailConnect = true

      await expect(manager.start()).rejects.toThrow()
      expect(transport1.connected).toBe(true)
    })

    it('should handle partial stop failures', async () => {
      manager.use('primary')
      manager.use('secondary')
      await manager.start()

      transport1.shouldFailDisconnect = true
      await expect(manager.stop()).rejects.toThrow()
    })

    it('should recover from failed operations', async () => {
      transport1.shouldFailConnect = true
      await expect(manager.start('primary')).rejects.toThrow()

      transport1.shouldFailConnect = false
      await expect(manager.start('primary')).resolves.not.toThrow()
    })
  })

  describe('edge cases', () => {
    it('should handle rapid bus switching', async () => {
      for (let i = 0; i < 100; i++) {
        const bus = i % 2 === 0 ? manager.use('primary') : manager.use('secondary')
        expect(bus).toBeDefined()
      }
    })

    it('should handle empty transport configuration', () => {
      const emptyManager = new BusManager({
        transports: {},
      })
      expect(emptyManager.transports).toEqual([])
    })

    it('should handle single transport configuration', () => {
      const singleManager = new BusManager({
        default: 'only',
        transports: {
          only: { transport: transport1, codec: 'json' },
        },
      })
      expect(singleManager.transports).toEqual(['only'])
    })

    it('should handle many transports', () => {
      const manyTransports = Object.fromEntries(
        Array.from({ length: 10 }, (_, i) => [
          `transport${i}`,
          { transport: new MockTransport(), codec: 'json' as const },
        ]),
      )
      const manyManager = new BusManager({ transports: manyTransports })
      expect(manyManager.transports).toHaveLength(10)
    })
  })
})
