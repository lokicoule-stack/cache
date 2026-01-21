import type { BenchmarkConfig } from '../config/benchmark.config.js'

export interface StatisticalResult {
  // Central tendency
  mean: number
  median: number
  mode: number

  // Spread
  stdDev: number
  variance: number
  min: number
  max: number
  range: number

  // Percentiles (latency distribution)
  p50: number
  p75: number
  p90: number
  p95: number
  p99: number
  p999: number

  // Confidence interval
  confidenceInterval: {
    level: number
    lower: number
    upper: number
    marginOfError: number
  }

  // Sample info
  sampleCount: number
  outlierCount: number
  cleanSampleCount: number

  // Derived metrics
  opsPerSecond: number
  throughputMBps?: number
}

export class StatisticalAnalyzer {
  #config: BenchmarkConfig['statistics']

  constructor(config: BenchmarkConfig['statistics']) {
    this.#config = config
  }

  analyze(samples: number[], payloadBytes?: number): StatisticalResult {
    if (samples.length === 0) {
      throw new Error('Cannot analyze empty samples array')
    }

    // 1. Sort samples
    const sorted = [...samples].sort((a, b) => a - b)

    // 2. Detect and remove outliers using IQR method
    const q1 = this.#percentile(sorted, 0.25)
    const q3 = this.#percentile(sorted, 0.75)
    const iqr = q3 - q1
    const lowerBound = q1 - this.#config.outlierThreshold * iqr
    const upperBound = q3 + this.#config.outlierThreshold * iqr

    const cleanSamples = sorted.filter(s => s >= lowerBound && s <= upperBound)
    const outlierCount = sorted.length - cleanSamples.length

    if (cleanSamples.length < this.#config.minSamples) {
      throw new Error(
        `Not enough clean samples: ${cleanSamples.length} < ${this.#config.minSamples}`
      )
    }

    // 3. Calculate statistics on clean samples
    const mean = this.#mean(cleanSamples)
    const stdDev = this.#stdDev(cleanSamples, mean)

    // 4. Calculate confidence interval
    const standardError = stdDev / Math.sqrt(cleanSamples.length)
    const tValue = this.#tDistribution(cleanSamples.length - 1, this.#config.confidenceLevel)
    const marginOfError = tValue * standardError

    // 5. Calculate percentiles
    const p50 = this.#percentile(cleanSamples, 0.5)
    const p75 = this.#percentile(cleanSamples, 0.75)
    const p90 = this.#percentile(cleanSamples, 0.9)
    const p95 = this.#percentile(cleanSamples, 0.95)
    const p99 = this.#percentile(cleanSamples, 0.99)
    const p999 = this.#percentile(cleanSamples, 0.999)

    // 6. Calculate throughput (samples are in microseconds)
    const opsPerSecond = mean > 0 ? 1_000_000 / mean : 0
    const throughputMBps =
      payloadBytes && mean > 0 ? (payloadBytes / 1_048_576) * opsPerSecond : undefined

    return {
      mean,
      median: p50,
      mode: this.#mode(cleanSamples),
      stdDev,
      variance: stdDev * stdDev,
      min: cleanSamples[0],
      max: cleanSamples[cleanSamples.length - 1],
      range: cleanSamples[cleanSamples.length - 1] - cleanSamples[0],
      p50,
      p75,
      p90,
      p95,
      p99,
      p999,
      confidenceInterval: {
        level: this.#config.confidenceLevel,
        lower: mean - marginOfError,
        upper: mean + marginOfError,
        marginOfError,
      },
      sampleCount: sorted.length,
      outlierCount,
      cleanSampleCount: cleanSamples.length,
      opsPerSecond: Math.round(opsPerSecond),
      throughputMBps,
    }
  }

  #percentile(sorted: number[], p: number): number {
    const index = (sorted.length - 1) * p
    const lower = Math.floor(index)
    const upper = Math.ceil(index)
    const weight = index - lower
    return sorted[lower] * (1 - weight) + sorted[upper] * weight
  }

  #mean(values: number[]): number {
    return values.reduce((a, b) => a + b, 0) / values.length
  }

  #stdDev(values: number[], mean: number): number {
    const squaredDiffs = values.map(v => (v - mean) ** 2)
    return Math.sqrt(this.#mean(squaredDiffs))
  }

  #mode(values: number[]): number {
    // For continuous data, bucket into ranges
    const bucketSize = (values[values.length - 1] - values[0]) / 100
    const buckets = new Map<number, number>()

    for (const v of values) {
      const bucket = Math.floor(v / bucketSize) * bucketSize
      buckets.set(bucket, (buckets.get(bucket) ?? 0) + 1)
    }

    let maxCount = 0
    let mode = values[0]

    for (const [bucket, count] of buckets) {
      if (count > maxCount) {
        maxCount = count
        mode = bucket
      }
    }

    return mode
  }

  #tDistribution(df: number, confidence: number): number {
    // Pre-computed t-values for common degrees of freedom
    const tTable: Record<number, Record<string, number>> = {
      0.95: {
        '10': 2.228,
        '30': 2.042,
        '60': 2.0,
        '120': 1.98,
        Infinity: 1.96,
      },
      0.99: {
        '10': 3.169,
        '30': 2.75,
        '60': 2.66,
        '120': 2.617,
        Infinity: 2.576,
      },
    }

    const table = tTable[confidence] ?? tTable[0.95]
    if (df >= 120) return table.Infinity
    if (df >= 60) return table['60']
    if (df >= 30) return table['30']
    return table['10']
  }
}
