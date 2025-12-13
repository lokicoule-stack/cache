import { describe, expect, it, vi } from 'vitest'
import { composeMiddleware } from '@/core/middleware/middleware'
import { FakeTransport } from '@test/doubles/transports'

describe('composeMiddleware', () => {
  it('returns base transport when no config', () => {
    const transport = new FakeTransport()

    const result = composeMiddleware(transport)

    expect(result).toBe(transport)
  })

  it('composes compression middleware', async () => {
    const transport = new FakeTransport()

    const composed = composeMiddleware(transport, {
      compression: {
        type: 'gzip',
        threshold: 2000,
      },
      retry: false,
    })
    await composed.connect()

    const data = new TextEncoder().encode('x'.repeat(2000))
    await composed.publish('ch', data)

    const published = transport.getPublishedMessages()[0]
    expect(published.data.length).toBeLessThan(data.length)
  })

  it('composes integrity middleware', async () => {
    const transport = new FakeTransport()
    const key = Buffer.from('0'.repeat(64), 'hex')

    const composed = composeMiddleware(transport, {
      integrity: { type: 'hmac', key },
      retry: false,
    })
    await composed.connect()

    const data = new TextEncoder().encode('secret')
    await composed.publish('ch', data)

    const published = transport.getPublishedMessages()[0]
    expect(published.data).not.toEqual(data)
    expect(published.data.length).toBeGreaterThan(data.length) // signature added
  })

  it('stacks multiple middlewares in correct order', async () => {
    const transport = new FakeTransport()
    const handler = vi.fn()
    const key = Buffer.from('0'.repeat(64), 'hex')

    const composed = composeMiddleware(transport, {
      compression: { threshold: 10 },
      integrity: { type: 'hmac', key },
      retry: false,
    })
    await composed.connect()

    await composed.subscribe('ch', handler)
    const original = new TextEncoder().encode('x'.repeat(100))
    await composed.publish('ch', original)

    await new Promise((r) => setTimeout(r, 50))
    expect(handler).toHaveBeenCalledWith(original)
  })
})
