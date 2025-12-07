import { describe, expect, it } from 'vitest'
import { RedisTransport } from '@/infrastructure/transports/redis/redis-transport'
import { TransportError, TransportErrorCode } from '@/infrastructure/transports/transport-errors'

describe('RedisTransport', () => {
  describe('error states', () => {
    it('throws NOT_READY when publishing before connect', async () => {
      const transport = new RedisTransport()

      await expect(transport.publish('ch', new Uint8Array([1]))).rejects.toThrow(TransportError)
      await expect(transport.publish('ch', new Uint8Array([1]))).rejects.toMatchObject({
        code: TransportErrorCode.NOT_READY,
      })
    })

    it('throws NOT_READY when subscribing before connect', async () => {
      const transport = new RedisTransport()

      await expect(transport.subscribe('ch', () => {})).rejects.toThrow(TransportError)
      await expect(transport.subscribe('ch', () => {})).rejects.toMatchObject({
        code: TransportErrorCode.NOT_READY,
      })
    })

    it('throws NOT_READY when unsubscribing before connect', async () => {
      const transport = new RedisTransport()

      await expect(transport.unsubscribe('ch')).rejects.toThrow(TransportError)
      await expect(transport.unsubscribe('ch')).rejects.toMatchObject({
        code: TransportErrorCode.NOT_READY,
      })
    })

    it('includes operation context in error', async () => {
      const transport = new RedisTransport()

      try {
        await transport.publish('test-channel', new Uint8Array([1]))
        expect.fail('Should have thrown')
      } catch (err) {
        const error = err as TransportError
        expect(error.context?.operation).toBe('publish')
        expect(error.context?.transport).toBe('redis')
        expect(error.context?.retryable).toBe(false)
      }
    })

    it('registers reconnect callback', () => {
      const transport = new RedisTransport()
      const callback = () => {}

      expect(() => transport.onReconnect(callback)).not.toThrow()
    })
  })

  describe('factory function', () => {
    it('creates RedisTransport instance', async () => {
      const { redis } = await import('@/infrastructure/transports/redis/redis-transport')
      const transport = redis()

      expect(transport).toBeInstanceOf(RedisTransport)
      expect(transport.name).toBe('redis')
    })

    it('creates RedisTransport with config', async () => {
      const { redis } = await import('@/infrastructure/transports/redis/redis-transport')
      const transport = redis({ url: 'redis://localhost:6379' })

      expect(transport).toBeInstanceOf(RedisTransport)
    })
  })
})
