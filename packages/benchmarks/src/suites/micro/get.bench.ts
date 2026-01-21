import type { BenchmarkSuite } from '../../harness/runner.js'
import type { CacheAdapter } from '../../adapters/types.js'
import { payloads } from '../../fixtures/payloads.js'
import { generateKeys, randomKey } from '../../fixtures/keys.js'

export function createGetSuite(adapters: CacheAdapter[]): BenchmarkSuite {
  const keys = generateKeys(10_000)

  return {
    name: 'Single Get Latency',
    category: 'micro',
    scenarios: [
      // L1 Hit (memory) - best case
      {
        name: 'L1 Hit (small payload)',
        adapters,
        payloadSize: JSON.stringify(payloads.small).length,
        async setup() {
          for (const adapter of adapters) {
            await adapter.connect()
            // Pre-populate all adapters with same data
            for (const key of keys) {
              await adapter.set(key, payloads.small)
            }
          }
        },
        fn: async adapter => {
          const key = randomKey(keys)
          await adapter.get(key)
        },
        async teardown() {
          for (const adapter of adapters) {
            await adapter.clear()
            await adapter.disconnect()
          }
        },
      },

      // Cache Miss - worst case
      {
        name: 'Cache Miss',
        adapters,
        async setup() {
          for (const adapter of adapters) {
            await adapter.connect()
            await adapter.clear()
          }
        },
        fn: async adapter => {
          const key = `miss:${Math.random()}`
          await adapter.get(key)
        },
        async teardown() {
          for (const adapter of adapters) {
            await adapter.disconnect()
          }
        },
      },

      // Medium payload
      {
        name: 'L1 Hit (medium payload)',
        adapters,
        payloadSize: JSON.stringify(payloads.medium).length,
        async setup() {
          for (const adapter of adapters) {
            await adapter.connect()
            for (const key of keys) {
              await adapter.set(key, payloads.medium)
            }
          }
        },
        fn: async adapter => {
          const key = randomKey(keys)
          await adapter.get(key)
        },
        async teardown() {
          for (const adapter of adapters) {
            await adapter.clear()
            await adapter.disconnect()
          }
        },
      },

      // Large payload
      {
        name: 'L1 Hit (large payload)',
        adapters,
        payloadSize: JSON.stringify(payloads.large).length,
        async setup() {
          for (const adapter of adapters) {
            await adapter.connect()
            for (const key of keys) {
              await adapter.set(key, payloads.large)
            }
          }
        },
        fn: async adapter => {
          const key = randomKey(keys)
          await adapter.get(key)
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
