import { DecodeError, EncodeError } from '@/shared/errors'

import type { ICodec } from '@/core/codec'
import type { Serializable, TransportData } from '@/core/types'

/**
 * JSON codec implementation
 *
 * Standard JSON serialization using native JSON.stringify/parse.
 * Human-readable but less efficient than binary codecs.
 * Compatible with all JavaScript types that implement Serializable.
 *
 * @example
 * ```typescript
 * const codec = new JsonCodec()
 * const bytes = codec.encode({ id: 123, name: 'Alice' })
 * const data = codec.decode<User>(bytes)
 * ```
 */
export class JsonCodec implements ICodec {
  readonly name = 'json'

  /**
   * Encode data to JSON bytes
   *
   * Uses JSON.stringify followed by UTF-8 encoding.
   *
   * @template T - The data type to encode
   * @param data - The data to encode
   * @returns UTF-8 encoded JSON bytes
   * @throws {EncodeError} If JSON.stringify fails (e.g., circular references)
   */
  encode<T extends Serializable>(data: T): TransportData {
    try {
      return new TextEncoder().encode(JSON.stringify(data))
    } catch (error) {
      throw new EncodeError(this.name, error as Error)
    }
  }

  /**
   * Decode JSON bytes to data
   *
   * Uses UTF-8 decoding followed by JSON.parse.
   *
   * @template T - The expected data type
   * @param data - The JSON bytes to decode
   * @returns Parsed data
   * @throws {DecodeError} If UTF-8 decoding or JSON.parse fails
   */
  decode<T extends Serializable>(data: TransportData): T {
    try {
      return JSON.parse(new TextDecoder().decode(data)) as T
    } catch (error) {
      throw new DecodeError(this.name, error as Error)
    }
  }
}
