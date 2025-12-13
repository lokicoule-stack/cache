import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { RedisTransport } from '@/infrastructure/transports/redis/redis-transport'
import { runTransportContractTests } from '@test/suites/transport-contract'
import { testConfig } from '@test/config'
import { isDockerAvailable } from '@test/helpers/docker'
import { EventCollector } from '@test/helpers'

const dockerAvailable = isDockerAvailable()

describe.skipIf(!dockerAvailable)('RedisTransport Integration', async () => {
  const { RedisContainer } = await import('@testcontainers/redis')

  type Container = Awaited<ReturnType<InstanceType<typeof RedisContainer>['start']>>

  let container: Container

  beforeAll(async () => {
    container = await new RedisContainer(testConfig.redis.image).start()
  }, testConfig.timeouts.container)

  afterAll(async () => {
    await container?.stop()
  })

  // Run contract tests with real Redis
  runTransportContractTests(
    () =>
      new RedisTransport({
        url: container.getConnectionUrl(),
      }),
    { skipDisconnectedTests: false },
  )

  describe('Redis-specific behavior', () => {
    let transport: RedisTransport

    beforeEach(async () => {
      transport = new RedisTransport({
        url: container.getConnectionUrl(),
      })
      await transport.connect()
    })

    afterEach(async () => {
      await transport?.disconnect()
    })

    it('delivers messages via real Redis pub/sub', async () => {
      const collector = new EventCollector<Uint8Array>()
      const data = new TextEncoder().encode('hello redis')

      await transport.subscribe('test-channel', (d) => collector.add(d))
      await new Promise((r) => setTimeout(r, 100))
      await transport.publish('test-channel', data)

      const received = await collector.waitForEvent(undefined, 5000)
      expect(new TextDecoder().decode(received)).toBe('hello redis')
    })

    it('handles multiple concurrent subscriptions', async () => {
      const collectors = {
        ch1: new EventCollector<Uint8Array>(),
        ch2: new EventCollector<Uint8Array>(),
      }

      await transport.subscribe('ch1', (d) => collectors.ch1.add(d))
      await transport.subscribe('ch2', (d) => collectors.ch2.add(d))
      await new Promise((r) => setTimeout(r, 100))

      await Promise.all([
        transport.publish('ch1', new Uint8Array([1])),
        transport.publish('ch2', new Uint8Array([2])),
      ])

      const [msg1, msg2] = await Promise.all([
        collectors.ch1.waitForEvent(undefined, 5000),
        collectors.ch2.waitForEvent(undefined, 5000),
      ])

      expect(msg1).toEqual(new Uint8Array([1]))
      expect(msg2).toEqual(new Uint8Array([2]))
    })
  })
})
