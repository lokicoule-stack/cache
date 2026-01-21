import type { EventEmitter } from '../observability/events'

/**
 * Cache plugin interface
 *
 * Plugins receive the event emitter and can subscribe to cache events
 * to add functionality like metrics, logging, tracing, etc.
 *
 * @example
 * ```ts
 * const metricsPlugin: CachePlugin = {
 *   name: 'metrics',
 *   register(emitter) {
 *     emitter.on('hit', ({ key }) => metrics.increment('cache.hit', { key }))
 *     emitter.on('miss', ({ key }) => metrics.increment('cache.miss', { key }))
 *   }
 * }
 *
 * const cache = createCache({
 *   plugins: [metricsPlugin]
 * })
 * ```
 */
export interface CachePlugin {
  /** Plugin name for debugging */
  name: string
  /** Called during cache initialization */
  register(emitter: EventEmitter): void
}
