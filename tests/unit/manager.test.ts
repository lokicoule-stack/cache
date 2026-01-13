import { describe, it, expect, beforeEach } from 'vitest'

import { createCacheManager, type GenericCacheManager } from '@/index'
import { FakeL2Store } from '../support/fake-store'

describe('CacheManager', () => {
  describe('with drivers and stores', () => {
    let remote1: FakeL2Store
    let remote2: FakeL2Store
    let manager: GenericCacheManager

    beforeEach(async () => {
      remote1 = new FakeL2Store()
      remote2 = new FakeL2Store()
      await remote1.connect()
      await remote2.connect()

      manager = createCacheManager({
        drivers: {
          redis: remote1,
          postgres: remote2,
        },
        stores: {
          main: ['redis'],
          analytics: ['postgres'],
        },
        staleTime: '1m',
      })
    })

    it('returns default cache when no name provided', () => {
      const cache = manager.use()
      expect(cache).toBeDefined()
    })

    it('returns named cache', () => {
      const cache = manager.use('analytics')
      expect(cache).toBeDefined()
    })

    it('throws for unknown cache name', () => {
      expect(() => manager.use('unknown')).toThrow('not found')
    })

    it('delete removes from all stores', async () => {
      await manager.use('main').set('key', 'value1')
      await manager.use('analytics').set('key', 'value2')

      await manager.delete('key')

      expect(await manager.use('main').get('key')).toBeUndefined()
      expect(await manager.use('analytics').get('key')).toBeUndefined()
    })

    it('clear clears all stores', async () => {
      await manager.use('main').set('a', 1)
      await manager.use('analytics').set('b', 2)

      await manager.clear()

      expect(await manager.use('main').get('a')).toBeUndefined()
      expect(await manager.use('analytics').get('b')).toBeUndefined()
    })
  })

  describe('memory-only mode', () => {
    it('works without any config', async () => {
      const manager = createCacheManager()

      await manager.set('key', 'value')
      expect(await manager.get('key')).toBe('value')
    })

    it('can disable memory with memory: false', async () => {
      const remote = new FakeL2Store()
      await remote.connect()

      const manager = createCacheManager({
        drivers: { redis: remote },
        stores: { default: { drivers: ['redis'], memory: false } },
        staleTime: '1m',
      })

      await manager.set('key', 'value')
      expect(await manager.get('key')).toBe('value')
    })
  })

  describe('implicit store creation', () => {
    it('creates default store with all drivers when no stores defined', async () => {
      const remote = new FakeL2Store()
      await remote.connect()

      const manager = createCacheManager({
        drivers: { redis: remote },
        staleTime: '1m',
      })

      await manager.set('key', 'value')
      expect(await manager.get('key')).toBe('value')
      expect(remote.size).toBe(1) // Written to L2
    })
  })

  describe('proxy methods', () => {
    it('get proxies to default store', async () => {
      const manager = createCacheManager()
      await manager.set('key', 'value')

      expect(await manager.get('key')).toBe('value')
    })

    it('has proxies to default store', async () => {
      const manager = createCacheManager()
      await manager.set('key', 'value')

      expect(await manager.has('key')).toBe(true)
      expect(await manager.has('missing')).toBe(false)
    })

    it('getOrSet proxies to default store', async () => {
      const manager = createCacheManager()

      const result = await manager.getOrSet('key', () => 'loaded')

      expect(result).toBe('loaded')
      expect(await manager.get('key')).toBe('loaded')
    })
  })
})
