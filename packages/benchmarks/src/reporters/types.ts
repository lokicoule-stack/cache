import type { BenchmarkResult } from '../harness/runner.js'

export interface ReporterOutput {
  summary: {
    timestamp: string
    duration: number
    totalBenchmarks: number
    environment: {
      node: string
      platform: string
      arch: string
    }
  }
  results: BenchmarkResult[]
  comparisons: ComparisonResult[]
}

export interface ComparisonResult {
  scenario: string
  baseline: string
  comparisons: Array<{
    adapter: string
    speedup: number
    latencyDelta: number
    throughputDelta: number
  }>
}

export interface Reporter {
  write(output: ReporterOutput, outputDir?: string): Promise<void>
}
