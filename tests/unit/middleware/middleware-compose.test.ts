import { describe, expect, it, vi } from 'vitest'
import { composeMiddleware } from '@/core/middleware/middleware'
import { FakeTransport } from '@test/doubles'
import { waitFor } from '@test/helpers'

describe('composeMiddleware', () => {
  it('returns base transport when no middleware configured', () => {
    const transport = new FakeTransport()

    const result = composeMiddleware(transport)

    expect(result).toBe(transport)
  })

  describe('compression middleware', () => {
    it('compresses large messages before publishing', async () => {
      const transport = new FakeTransport()
      const composed = composeMiddleware(transport, {
        compression: { type: 'gzip', threshold: 100 },
        retry: false,
      })
      await composed.connect()

      const largeData = new TextEncoder().encode('x'.repeat(200))
      await composed.publish('ch', largeData)

      const published = transport.getPublishedMessages()[0]
      expect(published.data.length).toBeLessThan(largeData.length)
    })
  })

  describe('integrity middleware', () => {
    it('adds signature to messages', async () => {
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
      expect(published.data.length).toBeGreaterThan(data.length) // Signature added
    })
  })

  describe('middleware stack', () => {
    it('applies middlewares in correct order and preserves message integrity', async () => {
      const transport = new FakeTransport()
      const key = Buffer.from('0'.repeat(64), 'hex')
      const handler = vi.fn()

      const composed = composeMiddleware(transport, {
        compression: { threshold: 10 },
        integrity: { type: 'hmac', key },
        retry: false,
      })
      await composed.connect()

      await composed.subscribe('ch', handler)
      const original = new TextEncoder().encode('x'.repeat(100))
      await composed.publish('ch', original)

      await waitFor(() => handler.mock.calls.length > 0)
      expect(handler).toHaveBeenCalledWith(original)
    })
  })
})
