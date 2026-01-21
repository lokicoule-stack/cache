export interface BenchmarkConfig {
  timing: {
    warmupDuration: number
    warmupIterations: number
    measurementDuration: number
    minIterations: number
    maxIterations: number
    cooldownBetweenTests: number
  }
  statistics: {
    confidenceLevel: number
    outlierThreshold: number
    minSamples: number
  }
  redis: {
    image: string
    connectionTimeout: number
  }
  concurrency: {
    levels: number[]
  }
  payloads: {
    small: number
    medium: number
    large: number
  }
}

export const defaultConfig: BenchmarkConfig = {
  timing: {
    warmupDuration: 2000,
    warmupIterations: 100,
    measurementDuration: 5000,
    minIterations: 1000,
    maxIterations: 100_000,
    cooldownBetweenTests: 500,
  },
  statistics: {
    confidenceLevel: 0.95,
    outlierThreshold: 1.5,
    minSamples: 100,
  },
  redis: {
    image: 'redis:7-alpine',
    connectionTimeout: 5000,
  },
  concurrency: {
    levels: [1, 10, 50, 100],
  },
  payloads: {
    small: 100,
    medium: 1024,
    large: 102_400,
  },
}
