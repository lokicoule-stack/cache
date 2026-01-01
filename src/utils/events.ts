import type { CacheEventType } from '../types'

type Listener = (data: unknown) => void

export interface EventEmitter {
  on(event: CacheEventType, fn: Listener): void
  off(event: CacheEventType, fn: Listener): void
  emit(event: CacheEventType, data: unknown): void
}

export function createEventEmitter(): EventEmitter {
  const listeners = new Map<CacheEventType, Set<Listener>>()

  return {
    on(event: CacheEventType, fn: Listener): void {
      let set = listeners.get(event)

      if (!set) {
        set = new Set()
        listeners.set(event, set)
      }
      set.add(fn)
    },

    off(event: CacheEventType, fn: Listener): void {
      const set = listeners.get(event)

      if (set) {
        set.delete(fn)
      }
    },

    emit(event: CacheEventType, data: unknown): void {
      const set = listeners.get(event)

      if (set) {
        for (const fn of set) {
          fn(data)
        }
      }
    },
  }
}
