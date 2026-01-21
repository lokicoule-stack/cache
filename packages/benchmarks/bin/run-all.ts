#!/usr/bin/env tsx

import { createRedisContainer } from '../src/infra/redis-container.js'
import { LokiverseAdapter, RedisAdapter, BentoCacheAdapter } from '../src/adapters/index.js'
import { BenchmarkRunner, type BenchmarkResult } from '../src/harness/runner.js'
import { defaultConfig } from '../src/config/index.js'
import { ConsoleReporter } from '../src/reporters/console.reporter.js'
import type { ReporterOutput, ComparisonResult } from '../src/reporters/types.js'

// Import benchmark suites
import { createGetSuite } from '../src/suites/micro/get.bench.js'
import { createSetSuite } from '../src/suites/micro/set.bench.js'
import { createStampedeSuite } from '../src/suites/scenarios/stampede.bench.js'

async function main() {
  console.log('🚀 Starting FAANG-level benchmark suite...\n')
  console.log('Benchmarking: @lokiverse/cache vs Redis (direct) vs BentoCache\n')

  // Use existing Redis from env or start testcontainer
  let redisUrl = process.env.REDIS_URL || process.env.REDIS_CONNECTION_STRING
  let redis: Awaited<ReturnType<typeof createRedisContainer>> | null = null

  if (!redisUrl) {
    console.log('No REDIS_URL found, starting testcontainer...\n')
    redis = await createRedisContainer(defaultConfig.redis.image)
    redisUrl = redis.getConnectionUrl()
  } else {
    console.log(`Using existing Redis at ${redisUrl}\n`)
  }

  try {
    // Create adapters
    const adapterConfig = {
      redisUrl,
      l1MaxItems: 10_000,
      defaultTtlMs: 60_000,
    }

    const adapters = [
      new LokiverseAdapter(adapterConfig),
      new RedisAdapter(adapterConfig),
      new BentoCacheAdapter(adapterConfig),
    ]

    // Create runner
    const runner = new BenchmarkRunner(defaultConfig)

    // Create benchmark suites
    const suites = [
      createGetSuite(adapters),
      createSetSuite(adapters),
      createStampedeSuite(adapters),
    ]

    // Run all suites
    const allResults: BenchmarkResult[] = []
    const startTime = Date.now()

    for (const suite of suites) {
      const results = await runner.run(suite)
      allResults.push(...results)
    }

    const duration = Date.now() - startTime

    // Generate comparisons
    const comparisons = generateComparisons(allResults)

    // Generate output
    const output: ReporterOutput = {
      summary: {
        timestamp: new Date().toISOString(),
        duration,
        totalBenchmarks: allResults.length,
        environment: {
          node: process.version,
          platform: process.platform,
          arch: process.arch,
        },
      },
      results: allResults,
      comparisons,
    }

    // Write console report
    const reporter = new ConsoleReporter()
    await reporter.write(output)

    console.log('\n✅ Benchmark complete!')
  } catch (error) {
    console.error('\n❌ Benchmark failed:', error)
    process.exit(1)
  } finally {
    // Cleanup
    if (redis) {
      await redis.cleanup()
    }
  }
}

function generateComparisons(results: BenchmarkResult[]): ComparisonResult[] {
  const byScenario = groupBy(results, r => r.scenario)
  const comparisons: ComparisonResult[] = []

  for (const [scenario, scenarioResults] of byScenario) {
    const baseline = scenarioResults.find(r => r.adapter === 'Redis (direct)')
    if (!baseline) continue

    const comparisonResults = scenarioResults
      .filter(r => r.adapter !== 'Redis (direct)')
      .map(r => ({
        adapter: r.adapter,
        speedup: baseline.statistics.mean / r.statistics.mean,
        latencyDelta: baseline.statistics.mean - r.statistics.mean,
        throughputDelta: r.statistics.opsPerSecond - baseline.statistics.opsPerSecond,
      }))

    comparisons.push({
      scenario,
      baseline: 'Redis (direct)',
      comparisons: comparisonResults,
    })
  }

  return comparisons
}

function groupBy<T, K>(arr: T[], keyFn: (item: T) => K): Map<K, T[]> {
  const map = new Map<K, T[]>()
  for (const item of arr) {
    const key = keyFn(item)
    const group = map.get(key) ?? []
    group.push(item)
    map.set(key, group)
  }
  return map
}

main().catch(console.error)
