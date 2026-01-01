import { describe, it, expect, beforeEach } from 'vitest'

import { CacheEntry } from '@/entry'
import { CacheStack } from '@/stack'
import { FakeL1Store, FakeL2Store } from '../support/fake-store'

function entry(value: unknown, staleTime = 60000) {
  return CacheEntry.create(value, { staleTime })
}

describe('CacheStack', () => {
  let l1: FakeL1Store
  let l2: FakeL2Store
  let stack: CacheStack

  beforeEach(() => {
    l1 = new FakeL1Store()
    l2 = new FakeL2Store()
    stack = new CacheStack({ local: l1, remotes: [l2] })
  })

  describe('get', () => {
    it('returns from local if present', async () => {
      l1.set('key', entry('local'))

      const result = await stack.get('key')

      expect(result.entry?.value).toBe('local')
      expect(result.source).toBe('fake-l1')
    })

    it('returns from remote if not in local', async () => {
      await l2.set('key', entry('remote'))

      const result = await stack.get('key')

      expect(result.entry?.value).toBe('remote')
      expect(result.source).toBe('fake-l2')
    })

    it('backfills local from remote hit', async () => {
      await l2.set('key', entry('remote'))

      await stack.get('key')

      expect(l1.get('key')?.value).toBe('remote')
    })

    it('returns empty for miss', async () => {
      const result = await stack.get('missing')

      expect(result.entry).toBeUndefined()
    })
  })

  describe('set', () => {
    it('writes to both local and remote', async () => {
      await stack.set('key', entry('value'))

      expect(l1.get('key')?.value).toBe('value')
      expect((await l2.get('key'))?.value).toBe('value')
    })
  })

  describe('delete', () => {
    it('deletes from both local and remote', async () => {
      await stack.set('key', entry('value'))

      await stack.delete('key')

      expect(l1.get('key')).toBeUndefined()
      expect(await l2.get('key')).toBeUndefined()
    })
  })

  describe('namespace', () => {
    it('prefixes keys', async () => {
      const ns = stack.namespace('users')

      await ns.set('1', entry('alice'))

      expect(l1.get('users:1')?.value).toBe('alice')
    })
  })

  describe('circuit breaker', () => {
    it('skips failing remote', async () => {
      l2.simulateFailure(true)
      l1.set('key', entry('local'))

      const result = await stack.get('key')

      expect(result.entry?.value).toBe('local')
    })
  })
})
