export interface CacheHitEvent {
  key: string
  store: string
  driver: string
  graced: boolean
  duration: number
}

export interface CacheMissEvent {
  key: string
  store: string
  duration: number
}

export interface CacheSetEvent {
  key: string
  store: string
  duration: number
}

export interface CacheDeleteEvent {
  key: string
  store: string
  duration: number
}

export interface CacheClearEvent {
  store: string
  duration: number
}

export interface CacheErrorEvent {
  key: string
  store: string
  error: Error
  duration: number
}

export interface BusPublishedEvent {
  channel: string
}

export interface BusReceivedEvent {
  channel: string
}

export interface CacheEventMap {
  hit: CacheHitEvent
  miss: CacheMissEvent
  set: CacheSetEvent
  delete: CacheDeleteEvent
  clear: CacheClearEvent
  error: CacheErrorEvent
  'bus:published': BusPublishedEvent
  'bus:received': BusReceivedEvent
}

export type CacheEventType = keyof CacheEventMap

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
