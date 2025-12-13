import { describe, expect, it } from 'vitest'
import { DeadLetterError } from '@/core/middleware/retry/retry-errors'
import { CodecError, CodecErrorCode } from '@/infrastructure/codecs/codec-errors'
import { CompressionError, CompressionErrorCode, CompressionConfigError } from '@/infrastructure/compression/compression-errors'
import { BusError, BusErrorCode, BusConfigError } from '@/core/bus/bus-errors'

describe('Error Serialization', () => {
  describe('toJSON() includes required fields', () => {
    it('serializes DeadLetterError with context', () => {
      const error = new DeadLetterError('Message exhausted retries', {
        context: { channel: 'orders', attempts: 5, maxAttempts: 5 },
      })

      const json = error.toJSON()

      expect(json).toMatchObject({
        name: 'DeadLetterError',
        message: 'Message exhausted retries',
        context: { channel: 'orders', attempts: 5, maxAttempts: 5 },
      })
      expect(json.stack).toBeDefined()
    })

    it('serializes CodecError with error code', () => {
      const error = new CodecError('Decode failed', CodecErrorCode.DECODE_FAILED, {
        context: { codec: 'msgpack' },
      })

      const json = error.toJSON()

      expect(json).toMatchObject({
        name: 'CodecError',
        code: 'DECODE_FAILED',
        context: { codec: 'msgpack' },
      })
    })

    it('serializes CompressionError with error code', () => {
      const error = new CompressionError('Compression failed', CompressionErrorCode.COMPRESSION_FAILED)

      const json = error.toJSON()

      expect(json).toMatchObject({
        name: 'CompressionError',
        code: 'COMPRESSION_FAILED',
      })
    })

    it('serializes BusError with error code', () => {
      const error = new BusError('Bus failed', BusErrorCode.BUS_ERROR, {
        context: { operation: 'publish' },
      })

      const json = error.toJSON()

      expect(json).toMatchObject({
        name: 'BusError',
        code: 'BUS_ERROR',
        context: { operation: 'publish' },
      })
    })
  })

  describe('error inheritance', () => {
    it('CompressionConfigError inherits from CompressionError', () => {
      const error = new CompressionConfigError('Invalid threshold')

      expect(error).toBeInstanceOf(CompressionError)
      expect(error).toBeInstanceOf(Error)
      expect(error.code).toBe(CompressionErrorCode.INVALID_CONFIG)
    })

    it('BusConfigError inherits from BusError', () => {
      const error = new BusConfigError('Invalid config')

      expect(error).toBeInstanceOf(BusError)
      expect(error).toBeInstanceOf(Error)
      expect(error.code).toBe(BusErrorCode.INVALID_CONFIG)
    })
  })

  describe('errors without context', () => {
    it('handles missing context gracefully', () => {
      const error = new DeadLetterError('No context provided')

      const json = error.toJSON()

      expect(json.context).toBeUndefined()
      expect(json.name).toBe('DeadLetterError')
    })
  })
})
