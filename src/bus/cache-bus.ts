import type { Bus, BusSchema } from '@lokiverse/bus'

export interface CacheBusSchema extends BusSchema {
  'cache:invalidate': { keys: string[] }
  'cache:invalidate:tags': { tags: string[] }
  'cache:clear': Record<string, never>
}

export interface CacheBusConfig {
  bus: Bus<CacheBusSchema>
  onInvalidate: (keys: string[]) => void
  onInvalidateTags: (tags: string[]) => void
  onClear: () => void
}

export interface CacheBus {
  connect(): Promise<void>
  disconnect(): Promise<void>
  publishInvalidate(keys: string[]): Promise<void>
  publishInvalidateTags(tags: string[]): Promise<void>
  publishClear(): Promise<void>
}

export function createCacheBus(config: CacheBusConfig): CacheBus {
  const { bus, onInvalidate, onInvalidateTags, onClear } = config

  return {
    async connect(): Promise<void> {
      await bus.connect()
      await bus.subscribe('cache:invalidate', (data) => onInvalidate(data.keys))
      await bus.subscribe('cache:invalidate:tags', (data) => onInvalidateTags(data.tags))
      await bus.subscribe('cache:clear', () => onClear())
    },

    async disconnect(): Promise<void> {
      await bus.unsubscribe('cache:invalidate')
      await bus.unsubscribe('cache:invalidate:tags')
      await bus.unsubscribe('cache:clear')
      await bus.disconnect()
    },

    async publishInvalidate(keys: string[]): Promise<void> {
      if (keys.length > 0) {
        await bus.publish('cache:invalidate', { keys })
      }
    },

    async publishInvalidateTags(tags: string[]): Promise<void> {
      if (tags.length > 0) {
        await bus.publish('cache:invalidate:tags', { tags })
      }
    },

    async publishClear(): Promise<void> {
      await bus.publish('cache:clear', {})
    },
  }
}
