import { describe, it, expect, beforeEach } from 'vitest'

import { CacheManager } from '@/manager'
import { FakeL1Store } from '../support/fake-store'

describe('CacheManager', () => {
  let store1: FakeL1Store
  let store2: FakeL1Store
  let manager: CacheManager

  beforeEach(() => {
    store1 = new FakeL1Store()
    store2 = new FakeL1Store()
    manager = new CacheManager({
      default: 'main',
      stores: {
        main: { local: store1, staleTime: '1m' },
        secondary: { local: store2, staleTime: '1m' },
      },
    })
  })

  describe('use', () => {
    it('returns default cache when no name provided', () => {
      const cache = manager.use()

      expect(cache).toBeDefined()
    })

    it('returns named cache', () => {
      const cache = manager.use('secondary')

      expect(cache).toBeDefined()
    })

    it('throws for unknown cache name', () => {
      expect(() => manager.use('unknown')).toThrow('not found')
    })
  })

  describe('constructor', () => {
    it('throws if default cache not in stores', () => {
      expect(
        () =>
          new CacheManager({
            default: 'missing',
            stores: { main: { local: store1 } },
          }),
      ).toThrow('not found')
    })
  })

  describe('delete', () => {
    it('deletes from all caches', async () => {
      await manager.use('main').set('key', 'value1')
      await manager.use('secondary').set('key', 'value2')

      await manager.delete('key')

      expect(await manager.use('main').get('key')).toBeUndefined()
      expect(await manager.use('secondary').get('key')).toBeUndefined()
    })
  })

  describe('clear', () => {
    it('clears all caches', async () => {
      await manager.use('main').set('a', 1)
      await manager.use('secondary').set('b', 2)

      await manager.clear()

      expect(await manager.use('main').get('a')).toBeUndefined()
      expect(await manager.use('secondary').get('b')).toBeUndefined()
    })
  })
})
