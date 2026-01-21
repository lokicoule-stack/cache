import type { BenchmarkSuite } from '../../harness/runner.js'
import type { CacheAdapter } from '../../adapters/types.js'
import { payloads } from '../../fixtures/payloads.js'
import { uniqueKey } from '../../fixtures/keys.js'

export function createSetSuite(adapters: CacheAdapter[]): BenchmarkSuite {
  return {
    name: 'Single Set Latency',
    category: 'micro',
    scenarios: [
      {
        name: 'Set (small payload)',
        adapters,
        payloadSize: JSON.stringify(payloads.small).length,
        async setup() {
          for (const adapter of adapters) {
            await adapter.connect()
            await adapter.clear()
          }
        },
        fn: async adapter => {
          const key = uniqueKey()
          await adapter.set(key, payloads.small)
        },
        async teardown() {
          for (const adapter of adapters) {
            await adapter.clear()
            await adapter.disconnect()
          }
        },
      },

      {
        name: 'Set (medium payload)',
        adapters,
        payloadSize: JSON.stringify(payloads.medium).length,
        async setup() {
          for (const adapter of adapters) {
            await adapter.connect()
            await adapter.clear()
          }
        },
        fn: async adapter => {
          const key = uniqueKey()
          await adapter.set(key, payloads.medium)
        },
        async teardown() {
          for (const adapter of adapters) {
            await adapter.clear()
            await adapter.disconnect()
          }
        },
      },

      {
        name: 'Set (large payload)',
        adapters,
        payloadSize: JSON.stringify(payloads.large).length,
        async setup() {
          for (const adapter of adapters) {
            await adapter.connect()
            await adapter.clear()
          }
        },
        fn: async adapter => {
          const key = uniqueKey()
          await adapter.set(key, payloads.large)
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
