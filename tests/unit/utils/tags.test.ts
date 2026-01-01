import { describe, it, expect } from 'vitest'

import { TagIndex } from '@/utils/tags'

describe('TagIndex', () => {
  it('returns keys registered with a tag', () => {
    const index = new TagIndex()

    index.register('key1', ['users'])

    expect(index.getKeysByTags(['users'])).toEqual(new Set(['key1']))
  })

  it('returns keys for multiple tags', () => {
    const index = new TagIndex()

    index.register('key1', ['users'])
    index.register('key2', ['posts'])

    expect(index.getKeysByTags(['users', 'posts'])).toEqual(new Set(['key1', 'key2']))
  })

  it('returns empty set for unknown tag', () => {
    const index = new TagIndex()

    expect(index.getKeysByTags(['unknown'])).toEqual(new Set())
  })

  it('removes key from tags on unregister', () => {
    const index = new TagIndex()

    index.register('key1', ['users'])
    index.unregister('key1')

    expect(index.getKeysByTags(['users'])).toEqual(new Set())
  })

  it('replaces tags when key is re-registered', () => {
    const index = new TagIndex()

    index.register('key1', ['users', 'admins'])
    index.unregister('key1')
    index.register('key1', ['users'])

    expect(index.getKeysByTags(['admins'])).toEqual(new Set())
    expect(index.getKeysByTags(['users'])).toEqual(new Set(['key1']))
  })

  it('clears all tags', () => {
    const index = new TagIndex()

    index.register('key1', ['users'])
    index.clear()

    expect(index.getKeysByTags(['users'])).toEqual(new Set())
  })
})
