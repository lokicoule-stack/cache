import { RedisContainer, type StartedRedisContainer } from '@testcontainers/redis'
import { createClient } from 'redis'

import { benchmarkConfig } from '../config.js'

interface RedisSetup {
  container: StartedRedisContainer
  publisher: ReturnType<typeof createClient>
  subscriber: ReturnType<typeof createClient>
  url: string
}

export async function setupRedis(): Promise<RedisSetup> {
  console.log('🐳 Starting Redis container...')
  const container = await new RedisContainer(benchmarkConfig.redis.image).start()
  const url = container.getConnectionUrl()

  const publisher = createClient({ url })
  const subscriber = createClient({ url })

  await Promise.all([publisher.connect(), subscriber.connect()])

  console.log(`✅ Redis started at ${url}\n`)

  return { container, publisher, subscriber, url }
}

export async function teardownRedis(setup: RedisSetup): Promise<void> {
  await Promise.all([setup.publisher.quit(), setup.subscriber.quit(), setup.container.stop()])
  console.log('\nRedis container stopped')
}

export async function waitForSubscriptions(
  delayMs: number = benchmarkConfig.timing.warmup,
): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, delayMs))
}
