import { describe, expect, it } from 'vitest'

import {
  CodecError,
  CodecErrorCode,
  DEFAULT_MAX_PAYLOAD_SIZE,
  JsonCodec,
  SizeValidatingCodec,
} from '@/infrastructure/codecs'

describe('SizeValidatingCodec', () => {
  const baseCodec = new JsonCodec()

  const validationCases = [
    { name: 'small payload within limit', maxSize: 1000, payloadSize: 10, shouldPass: true },
    { name: 'payload exceeds limit', maxSize: 100, payloadSize: 200, shouldPass: false },
    { name: 'payload at exact boundary', maxSize: 50, payloadSize: 30, shouldPass: true },
  ] as const

  describe.each(['encode', 'decode'] as const)('%s', (operation) => {
    it.each(validationCases)('$name', ({ maxSize, payloadSize, shouldPass }) => {
      const codec = new SizeValidatingCodec(baseCodec, maxSize)
      const data = { msg: 'x'.repeat(payloadSize) }

      if (operation === 'encode') {
        if (shouldPass) {
          expect(() => codec.encode(data)).not.toThrow()
        } else {
          expect(() => codec.encode(data)).toThrow(CodecError)
        }
      } else {
        const encoded = new TextEncoder().encode(JSON.stringify(data))
        if (shouldPass) {
          expect(() => codec.decode(encoded)).not.toThrow()
        } else {
          expect(() => codec.decode(encoded)).toThrow(CodecError)
        }
      }
    })

    it('includes context on error', () => {
      const codec = new SizeValidatingCodec(baseCodec, 100)
      const data = { msg: 'x'.repeat(200) }

      try {
        if (operation === 'encode') {
          codec.encode(data)
        } else {
          codec.decode(new TextEncoder().encode(JSON.stringify(data)))
        }
        expect.fail('Should have thrown')
      } catch (error) {
        const e = error as CodecError
        expect(e.code).toBe(CodecErrorCode.PAYLOAD_TOO_LARGE)
        expect(e.context?.operation).toBe(operation)
        expect(e.context?.codec).toBe('json')
        expect(e.context?.maxPayloadSize).toBe(100)
        expect(e.context?.payloadSize).toBeGreaterThan(100)
      }
    })
  })

  describe('defaults', () => {
    it('uses 10MB limit by default', () => {
      const codec = new SizeValidatingCodec(baseCodec)
      const under10MB = { msg: 'x'.repeat(9 * 1024 * 1024) }
      const over10MB = { msg: 'x'.repeat(11 * 1024 * 1024) }

      expect(codec.encode(under10MB).length).toBeLessThan(DEFAULT_MAX_PAYLOAD_SIZE)
      expect(() => codec.encode(over10MB)).toThrow(CodecError)
    })

    it('includes inner codec name in wrapper name', () => {
      const codec = new SizeValidatingCodec(baseCodec)

      expect(codec.name).toBe('json-with-size-validation')
    })
  })
})
