import type { Task } from 'tinybench'

interface BenchmarkResult {
  name: string
  opsPerSecond: number
  avgTimeUs: number
  samples: number
}

export function formatBenchmarkResults(tasks: Task[]): BenchmarkResult[] {
  return tasks.map((task) => {
    const state = task.result.state

    if (state === 'completed' || state === 'aborted-with-statistics') {
      const throughputMean = task.result.throughput.mean
      const latencyMean = task.result.latency.mean
      const samplesCount = task.result.latency.samplesCount

      return {
        name: task.name,
        opsPerSecond: Math.round(throughputMean),
        avgTimeUs: latencyMean * 1000,
        samples: samplesCount,
      }
    }

    return {
      name: task.name,
      opsPerSecond: 0,
      avgTimeUs: 0,
      samples: 0,
    }
  })
}

export function calculateOverhead(baselineOps: number, measuredOps: number): number {
  if (baselineOps === 0) return 0
  return ((baselineOps - measuredOps) / baselineOps) * 100
}

export function calculateSizeReduction(originalSize: number, compressedSize: number): number {
  if (originalSize === 0) return 0
  return ((originalSize - compressedSize) / originalSize) * 100
}

export function displayResultsTable(results: BenchmarkResult[]): void {
  console.table(
    results.map((r) => ({
      Method: r.name,
      'ops/sec': r.opsPerSecond.toLocaleString(),
      'Time (µs)': r.avgTimeUs.toFixed(2),
      Samples: r.samples,
    })),
  )
}

export function displaySizeComparison(label: string, jsonSize: number, msgpackSize: number): void {
  const reduction = calculateSizeReduction(jsonSize, msgpackSize)
  console.log(
    `${label}: ${jsonSize}B (JSON) → ${msgpackSize}B (MessagePack) = ${reduction.toFixed(
      1,
    )}% reduction`,
  )
}
