import { describe, beforeAll, afterAll } from 'vitest'
import { RedisContainer, type StartedRedisContainer } from '@testcontainers/redis'

import { syncDriverContract } from './sync-driver.contract'
import { asyncDriverContract } from './async-driver.contract'
import { FakeL1Driver } from '../support/drivers/fake-l1'
import { FakeL2Driver } from '../support/drivers/fake-l2'
import { RedisDriver } from '@/storage/drivers/redis'
import { isDockerAvailable } from '../support/testcontainers'

syncDriverContract('FakeL1Driver', () => new FakeL1Driver())

asyncDriverContract(
  'FakeL2Driver',
  async () => {
    const driver = new FakeL2Driver()
    await driver.connect()
    return driver
  },
  undefined,
  { useFakeTimers: true }, // In-memory fake driver: safe to use fake timers
)

const DOCKER_AVAILABLE = isDockerAvailable()

describe.skipIf(!DOCKER_AVAILABLE)('RedisDriver Contract', () => {
  let container: StartedRedisContainer
  let driver: RedisDriver | undefined

  beforeAll(async () => {
    container = await new RedisContainer('redis:7-alpine').start()
  }, 10_000)

  afterAll(async () => {
    if (container) {
      await container.stop()
    }
  }, 10_000)

  asyncDriverContract(
    'RedisDriver',
    async () => {
      driver = new RedisDriver({ url: container.getConnectionUrl() })
      await driver.connect()
      return driver
    },
    async () => {
      if (driver) {
        try {
          await driver.clear()
        } catch {
          // Ignore errors if already disconnected
        }
        await driver.disconnect()
        driver = undefined
      }
    },
    { useFakeTimers: false }, // External I/O: MUST use real timers
  )
})
