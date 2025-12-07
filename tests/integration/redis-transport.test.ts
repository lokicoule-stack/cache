/**
 * RedisTransport with real Redis instance.
 * Skipped if Docker unavailable.
 */

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { RedisTransport } from '@/infrastructure/transports/redis/redis-transport'
import { testConfig } from '@test/config'
import { isDockerAvailable } from '@test/helpers/docker'

const dockerAvailable = isDockerAvailable()

describe.skipIf(!dockerAvailable)('RedisTransport Integration', async () => {
  const { RedisContainer } = await import('@testcontainers/redis')

  type Container = Awaited<ReturnType<InstanceType<typeof RedisContainer>['start']>>

  let container: Container
  let transport: RedisTransport

  beforeAll(async () => {
    container = await new RedisContainer(testConfig.redis.image).start()
    transport = new RedisTransport({
      url: container.getConnectionUrl(),
    })
    await transport.connect()
  }, 60_000)

  afterAll(async () => {
    await transport?.disconnect()
    await container?.stop()
  })

  it('delivers messages via real Redis pub/sub', async () => {
    const handler = vi.fn()
    const data = new TextEncoder().encode('hello redis')

    await transport.subscribe('test-channel', handler)
    await new Promise((r) => setTimeout(r, 100))
    await transport.publish('test-channel', data)

    await vi.waitFor(() => expect(handler).toHaveBeenCalled(), { timeout: 5000 })

    const received = handler.mock.calls[0][0] as Uint8Array
    expect(new TextDecoder().decode(received)).toBe('hello redis')
  })
})
