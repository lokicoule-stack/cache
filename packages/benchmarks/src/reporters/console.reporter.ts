import type { Reporter, ReporterOutput } from './types.js'

export class ConsoleReporter implements Reporter {
  async write(output: ReporterOutput): Promise<void> {
    const { summary, results, comparisons } = output

    console.log('\n' + '='.repeat(80))
    console.log('  BENCHMARK RESULTS')
    console.log('='.repeat(80))
    console.log(`\n  Environment: Node ${summary.environment.node} on ${summary.environment.platform}`)
    console.log(`  Total benchmarks: ${summary.totalBenchmarks}`)
    console.log(`  Duration: ${(summary.duration / 1000).toFixed(1)}s\n`)

    // Group by category
    const byCategory = this.#groupBy(results, r => r.category)

    for (const [category, categoryResults] of byCategory) {
      console.log(`\n${'─'.repeat(80)}`)
      console.log(`  ${category.toUpperCase()}`)
      console.log('─'.repeat(80))

      // Group by scenario within category
      const byScenario = this.#groupBy(categoryResults, r => r.scenario)

      for (const [scenario, scenarioResults] of byScenario) {
        console.log(`\n  ${scenario}:`)
        console.log('  ' + '-'.repeat(78))
        console.log('  ' + this.#formatHeader())
        console.log('  ' + '-'.repeat(78))

        for (const result of scenarioResults) {
          console.log('  ' + this.#formatRow(result))
        }
      }
    }

    // Comparison summary
    if (comparisons.length > 0) {
      console.log('\n' + '='.repeat(80))
      console.log('  COMPARISON SUMMARY (vs Redis baseline)')
      console.log('='.repeat(80))

      for (const comparison of comparisons) {
        console.log(`\n  ${comparison.scenario}:`)
        for (const c of comparison.comparisons) {
          const speedupStr =
            c.speedup > 0
              ? `\x1b[32m+${c.speedup.toFixed(1)}x faster\x1b[0m`
              : `\x1b[31m${c.speedup.toFixed(1)}x slower\x1b[0m`
          console.log(`    ${c.adapter}: ${speedupStr}`)
        }
      }
    }

    console.log('\n')
  }

  #formatHeader(): string {
    return [
      'Adapter'.padEnd(24),
      'Ops/sec'.padStart(14),
      'p50 (µs)'.padStart(12),
      'p99 (µs)'.padStart(12),
      '95% CI'.padStart(12),
    ].join(' ')
  }

  #formatRow(result: { adapter: string; statistics: any }): string {
    const { statistics } = result
    const ci = `±${statistics.confidenceInterval.marginOfError.toFixed(1)}`

    return [
      result.adapter.padEnd(24),
      statistics.opsPerSecond.toLocaleString().padStart(14),
      statistics.p50.toFixed(1).padStart(12),
      statistics.p99.toFixed(1).padStart(12),
      ci.padStart(12),
    ].join(' ')
  }

  #groupBy<T, K>(arr: T[], keyFn: (item: T) => K): Map<K, T[]> {
    const map = new Map<K, T[]>()
    for (const item of arr) {
      const key = keyFn(item)
      const group = map.get(key) ?? []
      group.push(item)
      map.set(key, group)
    }
    return map
  }
}
