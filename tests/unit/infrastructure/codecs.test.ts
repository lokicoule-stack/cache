import { describe, expect, it } from 'vitest'
import { JsonCodec } from '@/infrastructure/codecs/json-codec'
import { MsgPackCodec } from '@/infrastructure/codecs/msgpack-codec'
import { Base64Codec } from '@/infrastructure/codecs/base64-codec'
import { CodecError, CodecErrorCode } from '@/infrastructure/codecs/codec-errors'
import type { Serializable } from '@/types'

describe('Codecs', () => {
  const testCases: Array<[string, Serializable]> = [
    ['null', null],
    ['boolean', true],
    ['number', 42],
    ['negative number', -273.15],
    ['string', 'hello world'],
    ['empty string', ''],
    ['array', [1, 'two', null, true]],
    ['nested object', { key: 'value', nested: { deep: { value: true } } }],
    ['empty object', {}],
    ['empty array', []],
  ]

  describe.each([
    ['JsonCodec', new JsonCodec()],
    ['MsgPackCodec', new MsgPackCodec()],
  ])('%s', (_, codec) => {
    describe('round-trip encoding', () => {
      it.each(testCases)('preserves %s through encode/decode', (_, value) => {
        const encoded = codec.encode(value)
        const decoded = codec.decode(encoded)

        expect(decoded).toEqual(value)
      })
    })

    it('produces Uint8Array output', () => {
      const encoded = codec.encode({ test: true })

      expect(encoded).toBeInstanceOf(Uint8Array)
    })

    it('exposes codec name', () => {
      expect(codec.name).toBeDefined()
      expect(typeof codec.name).toBe('string')
    })
  })

  describe('JsonCodec error handling', () => {
    const codec = new JsonCodec()

    it('throws ENCODE_FAILED for circular references', () => {
      const circular: Record<string, unknown> = { a: 1 }
      circular.self = circular

      expect(() => codec.encode(circular as Serializable)).toThrow(CodecError)

      try {
        codec.encode(circular as Serializable)
      } catch (error) {
        expect((error as CodecError).code).toBe(CodecErrorCode.ENCODE_FAILED)
      }
    })

    it('throws DECODE_FAILED for invalid JSON', () => {
      const invalidJson = new TextEncoder().encode('not valid json {')

      expect(() => codec.decode(invalidJson)).toThrow(CodecError)

      try {
        codec.decode(invalidJson)
      } catch (error) {
        expect((error as CodecError).code).toBe(CodecErrorCode.DECODE_FAILED)
      }
    })
  })

  describe('encoding invariants', () => {
    const codec = new JsonCodec()

    it('same input always produces same output', () => {
      const input = { deterministic: true, nested: { value: 42 } }

      const encoded1 = codec.encode(input)
      const encoded2 = codec.encode(input)

      expect(encoded1).toEqual(encoded2)
    })

    it('different inputs produce different outputs', () => {
      const input1 = { a: 1 }
      const input2 = { a: 2 }

      const encoded1 = codec.encode(input1)
      const encoded2 = codec.encode(input2)

      expect(encoded1).not.toEqual(encoded2)
    })
  })

  describe('Base64Codec', () => {
    const codec = new Base64Codec()

    it('exposes codec name', () => {
      expect(codec.name).toBe('base64')
    })

    it('round-trips binary data', () => {
      const input = new Uint8Array([0, 1, 2, 255, 128, 64])

      const encoded = codec.encode(input as unknown as Serializable)
      const decoded = codec.decode(encoded)

      expect(decoded).toEqual(input)
    })

    it('produces valid base64 string internally', () => {
      const input = new Uint8Array([72, 101, 108, 108, 111]) // "Hello"

      const encoded = codec.encode(input as unknown as Serializable)
      const base64String = Buffer.from(encoded).toString('utf8')

      expect(base64String).toBe('SGVsbG8=')
    })

    it('handles empty data', () => {
      const input = new Uint8Array([])

      const encoded = codec.encode(input as unknown as Serializable)
      const decoded = codec.decode(encoded)

      expect(decoded).toEqual(input)
    })

    it('handles large binary data', () => {
      const input = new Uint8Array(10000).map((_, i) => i % 256)

      const encoded = codec.encode(input as unknown as Serializable)
      const decoded = codec.decode(encoded)

      expect(decoded).toEqual(input)
    })
  })

  describe('MsgPackCodec error handling', () => {
    const codec = new MsgPackCodec()

    it('exposes codec name', () => {
      expect(codec.name).toBe('msgpack')
    })

    it('throws DECODE_FAILED for invalid msgpack data', () => {
      const invalidData = new Uint8Array([0xff, 0xff, 0xff, 0xff])

      expect(() => codec.decode(invalidData)).toThrow(CodecError)

      try {
        codec.decode(invalidData)
      } catch (error) {
        expect((error as CodecError).code).toBe(CodecErrorCode.DECODE_FAILED)
        expect((error as CodecError).context?.codec).toBe('msgpack')
        expect((error as CodecError).context?.operation).toBe('decode')
      }
    })

    it('throws ENCODE_FAILED for non-serializable data', () => {
      const nonSerializable = { fn: () => {} }

      expect(() => codec.encode(nonSerializable as unknown as Serializable)).toThrow(CodecError)

      try {
        codec.encode(nonSerializable as unknown as Serializable)
      } catch (error) {
        expect((error as CodecError).code).toBe(CodecErrorCode.ENCODE_FAILED)
        expect((error as CodecError).context?.codec).toBe('msgpack')
        expect((error as CodecError).context?.operation).toBe('encode')
      }
    })
  })
})
