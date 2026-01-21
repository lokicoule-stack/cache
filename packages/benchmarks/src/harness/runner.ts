import { Bench } from 'tinybench'
import type { BenchmarkConfig } from '../config/benchmark.config.js'
import type { CacheAdapter } from '../adapters/types.js'
import { StatisticalAnalyzer, type StatisticalResult } from './stats.js'

export interface BenchmarkResult {
  name: string
  adapter: string
  category: string
  scenario: string
  statistics: StatisticalResult
  metadata: {
    payloadSize?: number
    concurrency?: number
    hitRatio?: number
    timestamp: string
    nodeVersion: string
    platform: string
  }
}

export interface BenchmarkSuite {
  name: string
  category: 'micro' | 'throughput' | 'scenario' | 'memory'
  scenarios: BenchmarkScenario[]
}

export interface BenchmarkScenario {
  name: string
  adapters: CacheAdapter[]
  setup?: () => Promise<void>
  teardown?: () => Promise<void>
  fn: (adapter: CacheAdapter) => Promise<void>
  payloadSize?: number
  concurrency?: number
  hitRatio?: number
}

export class BenchmarkRunner {
  #config: BenchmarkConfig
  #analyzer: StatisticalAnalyzer

  constructor(config: BenchmarkConfig) {
    this.#config = config
    this.#analyzer = new StatisticalAnalyzer(config.statistics)
  }

  async run(suite: BenchmarkSuite): Promise<BenchmarkResult[]> {
    const results: BenchmarkResult[] = []

    console.log(`\nRunning suite: ${suite.name}`)
    console.log('='.repeat(80))

    for (const scenario of suite.scenarios) {
      console.log(`\n  Scenario: ${scenario.name}`)

      // Setup phase
      if (scenario.setup) {
        await scenario.setup()
      }

      for (const adapter of scenario.adapters) {
        console.log(`    Testing ${adapter.name}...`)

        // Warmup phase
        await this.#warmup(async () => scenario.fn(adapter))

        // Measurement phase with tinybench
        const bench = new Bench({
          time: this.#config.timing.measurementDuration,
          iterations: this.#config.timing.minIterations,
        })

        bench.add(adapter.name, async () => scenario.fn(adapter))

        await bench.run()

        const task = bench.tasks[0]
        if (!task?.result) {
          console.warn(`    WARNING: No results for ${adapter.name}`)
          continue
        }

        // Convert to microseconds for analysis (tinybench returns ms)
        const samplesUs = (task.result.samples ?? []).map(s => s * 1000)

        if (samplesUs.length === 0) {
          console.warn(`    WARNING: No samples collected for ${adapter.name}`)
          continue
        }

        const statistics = this.#analyzer.analyze(samplesUs, scenario.payloadSize)

        results.push({
          name: `${suite.name}/${scenario.name}`,
          adapter: adapter.name,
          category: suite.category,
          scenario: scenario.name,
          statistics,
          metadata: {
            payloadSize: scenario.payloadSize,
            concurrency: scenario.concurrency,
            hitRatio: scenario.hitRatio,
            timestamp: new Date().toISOString(),
            nodeVersion: process.version,
            platform: process.platform,
          },
        })

        // Cooldown between adapters
        await this.#cooldown()
      }

      // Teardown phase
      if (scenario.teardown) {
        await scenario.teardown()
      }
    }

    return results
  }

  async #warmup(fn: () => Promise<void>): Promise<void> {
    const start = Date.now()
    let iterations = 0

    while (
      Date.now() - start < this.#config.timing.warmupDuration &&
      iterations < this.#config.timing.warmupIterations
    ) {
      await fn()
      iterations++
    }
  }

  async #cooldown(): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, this.#config.timing.cooldownBetweenTests))

    // Force GC if available
    if (global.gc) {
      global.gc()
    }
  }
}
