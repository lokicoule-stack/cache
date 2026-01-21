import type { BenchmarkSuite } from '../../harness/runner.js'
import type { CacheAdapter } from '../../adapters/types.js'

export function createStampedeSuite(adapters: CacheAdapter[]): BenchmarkSuite {
  return {
    name: 'Stampede Protection',
    category: 'scenario',
    scenarios: [
      {
        name: '50 concurrent requests, same key (cold cache)',
        adapters,
        concurrency: 50,
        async setup() {
          for (const adapter of adapters) {
            await adapter.connect()
            await adapter.clear()
          }
        },
        fn: async adapter => {
          const key = `stampede:test:${Date.now()}`
          let factoryCallCount = 0

          const factory = async () => {
            factoryCallCount++
            // Simulate expensive DB call
            await new Promise(r => setTimeout(r, 10))
            return { data: 'expensive computation', timestamp: Date.now() }
          }

          // Launch 50 concurrent requests for the same key
          const promises = Array.from({ length: 50 }, () => {
            if (adapter.getOrSet) {
              return adapter.getOrSet(key, factory)
            }
            // Fallback for raw Redis (will have stampede)
            return adapter.get(key).then(v => v ?? factory().then(val => {
              adapter.set(key, val)
              return val
            }))
          })

          await Promise.all(promises)

          // For @lokiverse/cache: factoryCallCount should be 1
          // For raw Redis: factoryCallCount will be close to 50
        },
        async teardown() {
          for (const adapter of adapters) {
            await adapter.clear()
            await adapter.disconnect()
          }
        },
      },

      {
        name: '100 concurrent requests, 10 unique keys',
        adapters,
        concurrency: 100,
        async setup() {
          for (const adapter of adapters) {
            await adapter.connect()
            await adapter.clear()
          }
        },
        fn: async adapter => {
          const keys = Array.from({ length: 10 }, (_, i) => `key:${i}:${Date.now()}`)

          const createFactory = (key: string) => async () => {
            await new Promise(r => setTimeout(r, 5))
            return { key, value: Math.random(), timestamp: Date.now() }
          }

          // 100 requests distributed across 10 keys
          const promises = Array.from({ length: 100 }, (_, i) => {
            const key = keys[i % 10]
            const factory = createFactory(key)

            if (adapter.getOrSet) {
              return adapter.getOrSet(key, factory)
            }
            return adapter.get(key).then(v => v ?? factory().then(val => {
              adapter.set(key, val)
              return val
            }))
          })

          await Promise.all(promises)
        },
        async teardown() {
          for (const adapter of adapters) {
            await adapter.clear()
            await adapter.disconnect()
          }
        },
      },
    ],
  }
}
