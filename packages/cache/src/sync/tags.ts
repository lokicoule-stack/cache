/**
 * Tag-based cache key indexing
 *
 * Maintains bidirectional mapping between keys and tags for efficient invalidation.
 *
 * @module sync/tags
 */

export class TagIndex {
  readonly #tagToKeys = new Map<string, Set<string>>()
  readonly #keyToTags = new Map<string, Set<string>>()

  get size(): { keys: number; tags: number } {
    return {
      keys: this.#keyToTags.size,
      tags: this.#tagToKeys.size,
    }
  }

  /**
   * Register a key with its associated tags
   */
  register(key: string, tags: string[]): void {
    if (tags.length === 0) {
      return
    }

    this.#keyToTags.set(key, new Set(tags))

    for (const tag of tags) {
      let keys = this.#tagToKeys.get(tag)

      if (!keys) {
        keys = new Set()
        this.#tagToKeys.set(tag, keys)
      }
      keys.add(key)
    }
  }

  /**
   * Unregister a key and remove it from all tag associations
   */
  unregister(key: string): void {
    const tags = this.#keyToTags.get(key)

    if (!tags) {
      return
    }

    for (const tag of tags) {
      const keys = this.#tagToKeys.get(tag)

      if (keys) {
        keys.delete(key)
        if (keys.size === 0) {
          this.#tagToKeys.delete(tag)
        }
      }
    }

    this.#keyToTags.delete(key)
  }

  /**
   * Invalidate all keys associated with the given tags
   * @returns Set of invalidated keys
   */
  invalidate(tags: string[]): Set<string> {
    const keys = this.#getKeysByTags(tags)

    for (const key of keys) {
      this.unregister(key)
    }

    return keys
  }

  /**
   * Clear all tag associations
   */
  clear(): void {
    this.#tagToKeys.clear()
    this.#keyToTags.clear()
  }

  #getKeysByTags(tags: string[]): Set<string> {
    const result = new Set<string>()

    for (const tag of tags) {
      const keys = this.#tagToKeys.get(tag)

      if (keys) {
        for (const key of keys) {
          result.add(key)
        }
      }
    }

    return result
  }
}
