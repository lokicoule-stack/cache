/**
 * Test environment configuration.
 */

export const testConfig = {
  redis: {
    image: process.env.TEST_REDIS_IMAGE ?? 'redis:7-alpine',
  },
  timeouts: {
    container: 60_000,
    async: 5_000,
  },
} as const
