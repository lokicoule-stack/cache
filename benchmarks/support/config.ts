export const benchmarkConfig = {
  redis: {
    image: process.env.BENCHMARK_REDIS_IMAGE ?? 'redis:7-alpine',
  },
  timing: {
    warmup: 200,
    duration: 1500,
    iterations: 50,
  },
  thresholds: {
    smallPayloadBoundary: 100,
    mediumPayloadBoundary: 500,
    largePayloadBoundary: 5000,
  },
} as const
