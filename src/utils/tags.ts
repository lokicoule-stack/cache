export class TagIndex {
  #tagToKeys = new Map<string, Set<string>>()
  #keyToTags = new Map<string, Set<string>>()

  register(key: string, tags: string[]): void {
    if (tags.length === 0) {
      return
    }

    // Track tags for this key
    this.#keyToTags.set(key, new Set(tags))

    // Add key to each tag's set
    for (const tag of tags) {
      let keys = this.#tagToKeys.get(tag)

      if (!keys) {
        keys = new Set()
        this.#tagToKeys.set(tag, keys)
      }
      keys.add(key)
    }
  }

  unregister(key: string): void {
    const tags = this.#keyToTags.get(key)

    if (!tags) {
      return
    }

    // Remove key from each tag's set
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

  getKeysByTags(tags: string[]): Set<string> {
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

  clear(): void {
    this.#tagToKeys.clear()
    this.#keyToTags.clear()
  }
}
