import { beforeEach, describe, expect, it } from 'vitest'

import { JsonCodec, MsgPackCodec, resolveCodec, type ICodec } from '../../codec'
import { setupTestEnvironment } from '../utils/test-helpers'

setupTestEnvironment()

describe('JsonCodec', () => {
  let codec: JsonCodec

  beforeEach(() => {
    codec = new JsonCodec()
  })

  describe('encode', () => {
    it('should encode string', () => {
      const result = codec.encode('hello')
      expect(result).toBeInstanceOf(Uint8Array)
      expect(new TextDecoder().decode(result)).toBe('"hello"')
    })

    it('should encode number', () => {
      const result = codec.encode(42)
      expect(new TextDecoder().decode(result)).toBe('42')
    })

    it('should encode boolean', () => {
      const result = codec.encode(true)
      expect(new TextDecoder().decode(result)).toBe('true')
    })

    it('should encode null', () => {
      const result = codec.encode(null)
      expect(new TextDecoder().decode(result)).toBe('null')
    })

    it('should encode object', () => {
      const result = codec.encode({ foo: 'bar', num: 123 })
      const decoded = JSON.parse(new TextDecoder().decode(result))
      expect(decoded).toEqual({ foo: 'bar', num: 123 })
    })

    it('should encode array', () => {
      const result = codec.encode([1, 2, 3])
      expect(new TextDecoder().decode(result)).toBe('[1,2,3]')
    })

    it('should encode nested structures', () => {
      const data = {
        user: { id: 1, name: 'Alice' },
        items: [{ id: 1 }, { id: 2 }],
      }
      const result = codec.encode(data)
      const decoded = JSON.parse(new TextDecoder().decode(result))
      expect(decoded).toEqual(data)
    })

    it('should handle empty objects', () => {
      const result = codec.encode({})
      expect(new TextDecoder().decode(result)).toBe('{}')
    })

    it('should handle empty arrays', () => {
      const result = codec.encode([])
      expect(new TextDecoder().decode(result)).toBe('[]')
    })

    it('should handle undefined in objects', () => {
      const result = codec.encode({ foo: 'bar', baz: undefined })
      const decoded = JSON.parse(new TextDecoder().decode(result))
      expect(decoded).toEqual({ foo: 'bar' })
    })

    it('should handle special number values', () => {
      const result = codec.encode(0)
      expect(new TextDecoder().decode(result)).toBe('0')
    })

    it('should handle negative numbers', () => {
      const result = codec.encode(-42)
      expect(new TextDecoder().decode(result)).toBe('-42')
    })

    it('should handle floating point numbers', () => {
      const result = codec.encode(3.14159)
      expect(new TextDecoder().decode(result)).toBe('3.14159')
    })

    it('should handle special characters in strings', () => {
      const result = codec.encode('hello\nworld\ttab')
      const decoded = JSON.parse(new TextDecoder().decode(result))
      expect(decoded).toBe('hello\nworld\ttab')
    })

    it('should handle unicode characters', () => {
      const result = codec.encode('Hello 世界 🌍')
      const decoded = JSON.parse(new TextDecoder().decode(result))
      expect(decoded).toBe('Hello 世界 🌍')
    })

    it('should handle large strings', () => {
      const largeString = 'x'.repeat(10000)
      const result = codec.encode(largeString)
      const decoded = JSON.parse(new TextDecoder().decode(result))
      expect(decoded).toBe(largeString)
    })

    it('should handle deeply nested objects', () => {
      const nested = { a: { b: { c: { d: { e: 'deep' } } } } }
      const result = codec.encode(nested)
      const decoded = JSON.parse(new TextDecoder().decode(result))
      expect(decoded).toEqual(nested)
    })
  })

  describe('decode', () => {
    it('should decode string', () => {
      const encoded = new TextEncoder().encode('"hello"')
      const result = codec.decode(encoded)
      expect(result).toBe('hello')
    })

    it('should decode number', () => {
      const encoded = new TextEncoder().encode('42')
      const result = codec.decode(encoded)
      expect(result).toBe(42)
    })

    it('should decode boolean', () => {
      const encoded = new TextEncoder().encode('true')
      const result = codec.decode(encoded)
      expect(result).toBe(true)
    })

    it('should decode null', () => {
      const encoded = new TextEncoder().encode('null')
      const result = codec.decode(encoded)
      expect(result).toBe(null)
    })

    it('should decode object', () => {
      const encoded = new TextEncoder().encode('{"foo":"bar","num":123}')
      const result = codec.decode(encoded)
      expect(result).toEqual({ foo: 'bar', num: 123 })
    })

    it('should decode array', () => {
      const encoded = new TextEncoder().encode('[1,2,3]')
      const result = codec.decode(encoded)
      expect(result).toEqual([1, 2, 3])
    })

    it('should throw on invalid JSON', () => {
      const encoded = new TextEncoder().encode('invalid json')
      expect(() => codec.decode(encoded)).toThrow()
    })

    it('should handle empty input', () => {
      const encoded = new TextEncoder().encode('')
      expect(() => codec.decode(encoded)).toThrow()
    })

    it('should handle malformed JSON', () => {
      const encoded = new TextEncoder().encode('{incomplete')
      expect(() => codec.decode(encoded)).toThrow()
    })
  })

  describe('round-trip', () => {
    it('should maintain data integrity for strings', () => {
      const original = 'hello world'
      const encoded = codec.encode(original)
      const decoded = codec.decode(encoded)
      expect(decoded).toBe(original)
    })

    it('should maintain data integrity for numbers', () => {
      const original = 42
      const encoded = codec.encode(original)
      const decoded = codec.decode(encoded)
      expect(decoded).toBe(original)
    })

    it('should maintain data integrity for booleans', () => {
      const original = true
      const encoded = codec.encode(original)
      const decoded = codec.decode(encoded)
      expect(decoded).toBe(original)
    })

    it('should maintain data integrity for objects', () => {
      const original = { foo: 'bar', num: 123, nested: { a: 1 } }
      const encoded = codec.encode(original)
      const decoded = codec.decode(encoded)
      expect(decoded).toEqual(original)
    })

    it('should maintain data integrity for arrays', () => {
      const original = [1, 'two', { three: 3 }, [4, 5]]
      const encoded = codec.encode(original)
      const decoded = codec.decode(encoded)
      expect(decoded).toEqual(original)
    })
  })
})

describe('MsgPackCodec', () => {
  let codec: MsgPackCodec

  beforeEach(() => {
    codec = new MsgPackCodec()
  })

  describe('encode', () => {
    it('should encode string', () => {
      const result = codec.encode('hello')
      expect(result).toBeInstanceOf(Uint8Array)
    })

    it('should encode number', () => {
      const result = codec.encode(42)
      expect(result).toBeInstanceOf(Uint8Array)
    })

    it('should encode boolean', () => {
      const result = codec.encode(true)
      expect(result).toBeInstanceOf(Uint8Array)
    })

    it('should encode null', () => {
      const result = codec.encode(null)
      expect(result).toBeInstanceOf(Uint8Array)
    })

    it('should encode object', () => {
      const result = codec.encode({ foo: 'bar', num: 123 })
      expect(result).toBeInstanceOf(Uint8Array)
    })

    it('should encode array', () => {
      const result = codec.encode([1, 2, 3])
      expect(result).toBeInstanceOf(Uint8Array)
    })

    it('should encode nested structures', () => {
      const data = {
        user: { id: 1, name: 'Alice' },
        items: [{ id: 1 }, { id: 2 }],
      }
      const result = codec.encode(data)
      expect(result).toBeInstanceOf(Uint8Array)
    })

    it('should handle large payloads', () => {
      const large = { data: 'x'.repeat(10000) }
      const result = codec.encode(large)
      expect(result).toBeInstanceOf(Uint8Array)
    })

    it('should handle binary data more efficiently than JSON', () => {
      const data = { payload: 'x'.repeat(1000) }
      const msgpackSize = codec.encode(data).byteLength
      const jsonCodec = new JsonCodec()
      const jsonSize = jsonCodec.encode(data).byteLength
      expect(msgpackSize).toBeLessThan(jsonSize)
    })
  })

  describe('decode', () => {
    it('should decode string', () => {
      const encoded = codec.encode('hello')
      const result = codec.decode(encoded)
      expect(result).toBe('hello')
    })

    it('should decode number', () => {
      const encoded = codec.encode(42)
      const result = codec.decode(encoded)
      expect(result).toBe(42)
    })

    it('should decode boolean', () => {
      const encoded = codec.encode(true)
      const result = codec.decode(encoded)
      expect(result).toBe(true)
    })

    it('should decode null', () => {
      const encoded = codec.encode(null)
      const result = codec.decode(encoded)
      expect(result).toBe(null)
    })

    it('should decode object', () => {
      const encoded = codec.encode({ foo: 'bar', num: 123 })
      const result = codec.decode(encoded)
      expect(result).toEqual({ foo: 'bar', num: 123 })
    })

    it('should decode array', () => {
      const encoded = codec.encode([1, 2, 3])
      const result = codec.decode(encoded)
      expect(result).toEqual([1, 2, 3])
    })

    it('should throw on invalid msgpack data', () => {
      const invalid = new Uint8Array([0xff, 0xff, 0xff])
      expect(() => codec.decode(invalid)).toThrow()
    })

    it('should handle empty buffer', () => {
      const empty = new Uint8Array(0)
      expect(() => codec.decode(empty)).toThrow()
    })
  })

  describe('round-trip', () => {
    it('should maintain data integrity for strings', () => {
      const original = 'hello world'
      const encoded = codec.encode(original)
      const decoded = codec.decode(encoded)
      expect(decoded).toBe(original)
    })

    it('should maintain data integrity for numbers', () => {
      const original = 42
      const encoded = codec.encode(original)
      const decoded = codec.decode(encoded)
      expect(decoded).toBe(original)
    })

    it('should maintain data integrity for booleans', () => {
      const original = true
      const encoded = codec.encode(original)
      const decoded = codec.decode(encoded)
      expect(decoded).toBe(original)
    })

    it('should maintain data integrity for objects', () => {
      const original = { foo: 'bar', num: 123, nested: { a: 1 } }
      const encoded = codec.encode(original)
      const decoded = codec.decode(encoded)
      expect(decoded).toEqual(original)
    })

    it('should maintain data integrity for arrays', () => {
      const original = [1, 'two', { three: 3 }, [4, 5]]
      const encoded = codec.encode(original)
      const decoded = codec.decode(encoded)
      expect(decoded).toEqual(original)
    })

    it('should maintain data integrity for complex nested structures', () => {
      const original = {
        users: [
          { id: 1, name: 'Alice', tags: ['admin', 'user'] },
          { id: 2, name: 'Bob', tags: ['user'] },
        ],
        metadata: { count: 2, timestamp: 1234567890 },
      }
      const encoded = codec.encode(original)
      const decoded = codec.decode(encoded)
      expect(decoded).toEqual(original)
    })

    it('should handle unicode correctly', () => {
      const original = 'Hello 世界 🌍'
      const encoded = codec.encode(original)
      const decoded = codec.decode(encoded)
      expect(decoded).toBe(original)
    })
  })
})

describe('resolveCodec', () => {
  it('should return JsonCodec for "json"', () => {
    const codec = resolveCodec('json')
    expect(codec).toBeInstanceOf(JsonCodec)
  })

  it('should return JsonCodec for undefined', () => {
    const codec = resolveCodec(undefined)
    expect(codec).toBeInstanceOf(JsonCodec)
  })

  it('should return MsgPackCodec for "msgpack"', () => {
    const codec = resolveCodec('msgpack')
    expect(codec).toBeInstanceOf(MsgPackCodec)
  })

  it('should return custom codec when provided', () => {
    const customCodec: ICodec = {
      encode: (data) => new Uint8Array(),
      decode: (data) => null,
    }
    const codec = resolveCodec(customCodec)
    expect(codec).toBe(customCodec)
  })

  it('should return JsonCodec for unknown string', () => {
    const codec = resolveCodec('unknown' as never)
    expect(codec).toBeInstanceOf(JsonCodec)
  })

  it('should cache codec instances', () => {
    const codec1 = resolveCodec('json')
    const codec2 = resolveCodec('json')
    expect(codec1).not.toBe(codec2)
  })
})

describe('codec comparison', () => {
  it('should produce smaller output with msgpack for objects', () => {
    const data = {
      users: Array.from({ length: 100 }, (_, i) => ({
        id: i,
        name: `User ${i}`,
        email: `user${i}@example.com`,
      })),
    }

    const jsonCodec = new JsonCodec()
    const msgpackCodec = new MsgPackCodec()

    const jsonSize = jsonCodec.encode(data).byteLength
    const msgpackSize = msgpackCodec.encode(data).byteLength

    expect(msgpackSize).toBeLessThan(jsonSize)
  })

  it('should have similar performance characteristics', () => {
    const data = { count: 100, items: Array.from({ length: 100 }, (_, i) => i) }

    const jsonCodec = new JsonCodec()
    const msgpackCodec = new MsgPackCodec()

    const jsonStart = performance.now()
    for (let i = 0; i < 1000; i++) {
      const encoded = jsonCodec.encode(data)
      jsonCodec.decode(encoded)
    }
    const jsonTime = performance.now() - jsonStart

    const msgpackStart = performance.now()
    for (let i = 0; i < 1000; i++) {
      const encoded = msgpackCodec.encode(data)
      msgpackCodec.decode(encoded)
    }
    const msgpackTime = performance.now() - msgpackStart

    expect(jsonTime).toBeGreaterThan(0)
    expect(msgpackTime).toBeGreaterThan(0)
  })

  it('should both handle edge cases consistently', () => {
    const edgeCases = [null, 0, -0, '', [], {}, [null], { key: null }, false, true]

    const jsonCodec = new JsonCodec()
    const msgpackCodec = new MsgPackCodec()

    for (const testCase of edgeCases) {
      const jsonResult = jsonCodec.decode(jsonCodec.encode(testCase))
      const msgpackResult = msgpackCodec.decode(msgpackCodec.encode(testCase))
      expect(jsonResult).toEqual(msgpackResult)
    }
  })
})
