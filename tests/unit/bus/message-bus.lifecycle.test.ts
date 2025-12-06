/**
 * Message Bus - Lifecycle Tests
 *
 * Focus: Connect/disconnect, idempotency, cleanup
 */

import { ConfigurableTransport, createTransport } from '@test/doubles/transports'
import { channels } from '@test/fixtures'
import { delay } from '@test/helpers/async'
import { setupBusTest } from '@test/test-setup'
import { describe, expect, it } from 'vitest'

describe('MessageBus - Lifecycle', () => {
  const { createBus } = setupBusTest()

  it('should connect/disconnect idempotently', async () => {
    const transport = createTransport.fake()
    const { bus } = await createBus({ transport })

    await bus.connect()
    await bus.connect() // Second connect is no-op
    expect(transport.connected).toBe(true)

    await bus.disconnect()
    await bus.disconnect() // Second disconnect is no-op
    expect(transport.connected).toBe(false)
  })

  it('should clear handlers on disconnect', async () => {
    const { bus, handler } = await createBus()

    await bus.subscribe(channels.standard, handler)
    await bus.disconnect()
    await bus.connect()
    await bus.publish(channels.standard, 'test')

    await delay(50)
    expect(handler).not.toHaveBeenCalled()
  })

  it('should handle transport errors gracefully', async () => {
    const transport = new ConfigurableTransport({ connectFailure: true })
    const { bus } = await createBus({ transport, skipConnect: true })

    await expect(bus.connect()).rejects.toThrow()
  })
})
