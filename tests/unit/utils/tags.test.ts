import { describe, it, expect } from 'vitest'

import { TagIndex } from '@/utils/tags'

describe('TagIndex', () => {
  it('returns keys registered with a tag on invalidate', () => {
    const index = new TagIndex()

    index.register('key1', ['users'])

    expect(index.invalidate(['users'])).toEqual(new Set(['key1']))
  })

  it('returns keys for multiple tags on invalidate', () => {
    const index = new TagIndex()

    index.register('key1', ['users'])
    index.register('key2', ['posts'])

    expect(index.invalidate(['users', 'posts'])).toEqual(new Set(['key1', 'key2']))
  })

  it('returns empty set for unknown tag', () => {
    const index = new TagIndex()

    expect(index.invalidate(['unknown'])).toEqual(new Set())
  })

  it('removes keys from index after invalidate', () => {
    const index = new TagIndex()

    index.register('key1', ['users'])
    index.invalidate(['users'])

    expect(index.invalidate(['users'])).toEqual(new Set())
  })

  it('unregister removes key from all tags', () => {
    const index = new TagIndex()

    index.register('key1', ['users', 'admins'])
    index.unregister('key1')

    expect(index.invalidate(['users'])).toEqual(new Set())
    expect(index.invalidate(['admins'])).toEqual(new Set())
  })

  it('clears all tags', () => {
    const index = new TagIndex()

    index.register('key1', ['users'])
    index.clear()

    expect(index.invalidate(['users'])).toEqual(new Set())
  })
})
