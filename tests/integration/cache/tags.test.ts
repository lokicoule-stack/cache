import { describe, it, expect, beforeEach } from 'vitest'

import { createCache } from '@/index'
import { FakeL1Store, FakeL2Store } from '@test/fake-store'

describe('tag invalidation', () => {
  let l1: FakeL1Store
  let l2: FakeL2Store

  beforeEach(async () => {
    l1 = new FakeL1Store()
    l2 = new FakeL2Store()
    await l2.connect()
  })

  it('invalidateTags removes entries from L1', async () => {
    const cache = createCache({ l1, staleTime: '1m' })

    await cache.set('user:1', 'alice', { tags: ['users'] })
    await cache.set('user:2', 'bob', { tags: ['users'] })
    await cache.set('post:1', 'hello', { tags: ['posts'] })

    await cache.invalidateTags(['users'])

    expect(await cache.get('user:1')).toBeUndefined()
    expect(await cache.get('user:2')).toBeUndefined()
    expect(await cache.get('post:1')).toBe('hello')
  })

  it('invalidateTags removes entries from L1 and L2', async () => {
    const cache = createCache({ l1, l2, staleTime: '1m' })

    await cache.set('user:1', 'alice', { tags: ['users'] })
    expect(l1.size).toBe(1)
    expect(l2.size).toBe(1)

    await cache.invalidateTags(['users'])

    expect(l1.size).toBe(0)
    expect(l2.size).toBe(0)
  })

  it('matches entry with any of multiple tags', async () => {
    const cache = createCache({ l1, staleTime: '1m' })

    await cache.set('key', 'value', { tags: ['tag-a', 'tag-b'] })

    await cache.invalidateTags(['tag-a'])

    expect(await cache.get('key')).toBeUndefined()
  })

  it('works with namespaced keys', async () => {
    const cache = createCache({ l1, staleTime: '1m' })
    const users = cache.namespace('users')

    await users.set('1', 'alice', { tags: ['admins'] })
    await users.set('2', 'bob', { tags: ['users'] })

    await users.invalidateTags(['admins'])

    expect(await users.get('1')).toBeUndefined()
    expect(await users.get('2')).toBe('bob')
  })

  it('returns count of invalidated entries', async () => {
    const cache = createCache({ l1, staleTime: '1m' })

    await cache.set('a', 1, { tags: ['shared'] })
    await cache.set('b', 2, { tags: ['shared'] })
    await cache.set('c', 3, { tags: ['other'] })

    const count = await cache.invalidateTags(['shared'])

    expect(count).toBe(2)
  })
})
