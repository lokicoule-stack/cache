import type { MessageBus, BusSchema } from '@lokiverse/bus'

export interface CacheBusSchema extends BusSchema {
  'cache:invalidate': { keys: string[]; store: string }
  'cache:invalidate:tags': { tags: string[]; store: string }
  'cache:clear': { store: string }
}

export interface DistributedSyncCallbacks {
  onRemoteInvalidate: (keys: string[]) => void
  onRemoteClear: () => void
  onRemoteInvalidateTags: (tags: string[]) => void
}

/**
 * Distributed sync coordinator
 *
 * Responsibilities:
 * - Publish local mutations to other instances
 * - Subscribe to remote mutations and apply them locally
 * - Handle message bus lifecycle
 *
 * Architecture:
 * - Write operations: publish events to bus
 * - Read operations: no overhead (direct local cache)
 * - Remote events: trigger callbacks to invalidate local L1
 */
export class DistributedSync {
  readonly #bus: MessageBus<CacheBusSchema>
  readonly #storeName: string
  #callbacks?: DistributedSyncCallbacks

  constructor(bus: MessageBus<CacheBusSchema>, storeName: string) {
    this.#bus = bus
    this.#storeName = storeName
  }

  /**
   * Setup callbacks for remote events
   */
  setup(callbacks: DistributedSyncCallbacks): void {
    this.#callbacks = callbacks
    this.#subscribeToRemoteEvents()
  }

  /**
   * Publish key deletion to other instances
   */
  async onDelete(keys: string[]): Promise<void> {
    if (keys.length === 0) {
      return
    }

    await this.#bus.publish('cache:invalidate', {
      keys,
      store: this.#storeName,
    })
  }

  /**
   * Publish cache clear to other instances
   */
  async onClear(): Promise<void> {
    await this.#bus.publish('cache:clear', {
      store: this.#storeName,
    })
  }

  /**
   * Publish tag invalidation to other instances
   */
  async onInvalidateTags(tags: string[]): Promise<void> {
    if (tags.length === 0) {
      return
    }

    await this.#bus.publish('cache:invalidate:tags', {
      tags,
      store: this.#storeName,
    })
  }

  async connect(): Promise<void> {
    await this.#bus.connect()
  }

  async disconnect(): Promise<void> {
    await this.#bus.disconnect()
  }

  #subscribeToRemoteEvents(): void {
    void this.#bus.subscribe('cache:invalidate', ({ keys, store }) => {
      if (store !== this.#storeName) {
        return
      }
      this.#callbacks?.onRemoteInvalidate(keys)
    })

    void this.#bus.subscribe('cache:invalidate:tags', ({ tags, store }) => {
      if (store !== this.#storeName) {
        return
      }
      this.#callbacks?.onRemoteInvalidateTags(tags)
    })

    void this.#bus.subscribe('cache:clear', ({ store }) => {
      if (store !== this.#storeName) {
        return
      }
      this.#callbacks?.onRemoteClear()
    })
  }
}
