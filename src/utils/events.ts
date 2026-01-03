import type { CacheEventMap, CacheEventType } from '../types'

export interface Emitter<TEvents = CacheEventMap> {
  on<E extends keyof TEvents & string>(event: E, fn: (data: TEvents[E]) => void): void
  off<E extends keyof TEvents & string>(event: E, fn: (data: TEvents[E]) => void): void
  emit<E extends keyof TEvents & string>(event: E, data: TEvents[E]): void
}

export type EventEmitter = Emitter<CacheEventMap>

export function createEventEmitter(): EventEmitter {
  const listeners = new Map<CacheEventType, Set<(data: unknown) => void>>()

  return {
    on<E extends CacheEventType>(event: E, fn: (data: CacheEventMap[E]) => void): void {
      let set = listeners.get(event)

      if (!set) {
        set = new Set()
        listeners.set(event, set)
      }
      set.add(fn as (data: unknown) => void)
    },

    off<E extends CacheEventType>(event: E, fn: (data: CacheEventMap[E]) => void): void {
      const set = listeners.get(event)

      if (set) {
        set.delete(fn as (data: unknown) => void)
      }
    },

    emit<E extends CacheEventType>(event: E, data: CacheEventMap[E]): void {
      const set = listeners.get(event)

      if (set) {
        for (const fn of set) {
          fn(data)
        }
      }
    },
  }
}
