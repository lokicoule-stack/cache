import { describe, expect, it } from 'vitest'
import { JsonCodec } from '@/infrastructure/codecs/json-codec'
import { MsgPackCodec } from '@/infrastructure/codecs/msgpack-codec'
import { CodecError, CodecErrorCode } from '@/infrastructure/codecs/codec-errors'
import { Serializable } from '@/types'

describe('Codecs', () => {
  const testCases = [
    ['null', null] as Serializable,
    ['boolean', true] as Serializable,
    ['number', 42] as Serializable,
    ['string', 'hello'] as Serializable,
    ['array', [1, 2, 3]] as Serializable,
    ['object', { key: 'value', nested: { deep: true } }] as Serializable,
  ] as const

  describe.each([
    ['JsonCodec', new JsonCodec()],
    ['MsgPackCodec', new MsgPackCodec()],
  ])('%s', (_, codec) => {
    it.each(testCases)('round-trips %s', (_, value) => {
      const encoded = codec.encode(value)
      const decoded = codec.decode(encoded)

      expect(decoded).toEqual(value)
    })

    it('produces Uint8Array output', () => {
      const encoded = codec.encode({ test: true })

      expect(encoded).toBeInstanceOf(Uint8Array)
    })
  })

  describe('JsonCodec errors', () => {
    const codec = new JsonCodec()

    it('throws CodecError with ENCODE_FAILED for circular references', () => {
      const circular: Serializable = { a: 1 }
      circular.self = circular

      expect(() => codec.encode(circular)).toThrow(CodecError)

      try {
        codec.encode(circular)
      } catch (error) {
        expect(error).toBeInstanceOf(CodecError)
        expect((error as CodecError).code).toBe(CodecErrorCode.ENCODE_FAILED)
      }
    })

    it('throws CodecError with DECODE_FAILED for invalid JSON', () => {
      const invalid = new TextEncoder().encode('not valid json')

      expect(() => codec.decode(invalid)).toThrow(CodecError)

      try {
        codec.decode(invalid)
      } catch (error) {
        expect(error).toBeInstanceOf(CodecError)
        expect((error as CodecError).code).toBe(CodecErrorCode.DECODE_FAILED)
      }
    })
  })
})
