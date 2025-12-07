import { describe, expect, it, vi } from 'vitest'
import { MemoryTransport } from '@/infrastructure/transports/memory/memory-transport'

describe('MemoryTransport', () => {
  it('delivers messages to subscribers', async () => {
    const transport = new MemoryTransport()
    const handler = vi.fn()
    const data = new Uint8Array([1, 2, 3])

    await transport.subscribe('ch', handler)
    await transport.publish('ch', data)

    await new Promise((r) => setTimeout(r, 10))
    expect(handler).toHaveBeenCalledWith(data)
  })

  it('clears subscriptions on disconnect', async () => {
    const transport = new MemoryTransport()
    const handler = vi.fn()

    await transport.subscribe('ch', handler)
    await transport.disconnect()
    await transport.publish('ch', new Uint8Array([1]))

    await new Promise((r) => setTimeout(r, 10))
    expect(handler).not.toHaveBeenCalled()
  })

  it('removes channel on unsubscribe', async () => {
    const transport = new MemoryTransport()
    const handler = vi.fn()

    await transport.subscribe('ch', handler)
    await transport.unsubscribe('ch')
    await transport.publish('ch', new Uint8Array([1]))

    await new Promise((r) => setTimeout(r, 10))
    expect(handler).not.toHaveBeenCalled()
  })
})
