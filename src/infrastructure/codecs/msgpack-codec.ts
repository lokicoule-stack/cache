import { decode, encode } from '@msgpack/msgpack'

import { DecodeError, EncodeError } from './codec-errors'

import type { Codec } from '@/contracts/codec'
import type { Serializable, TransportData } from '@/types'

/**
 * MessagePack codec implementation
 *
 * Binary serialization using MessagePack format.
 * More compact and faster than JSON, but not human-readable.
 * Requires @msgpack/msgpack dependency.
 *
 * @see https://msgpack.org
 *
 * @example
 * ```typescript
 * const codec = new MsgPackCodec()
 * const bytes = codec.encode({ id: 123, name: 'Alice' })
 * const data = codec.decode<User>(bytes)
 * ```
 */
export class MsgPackCodec implements Codec {
  readonly name = 'msgpack'

  /**
   * Encode data to MessagePack bytes
   *
   * Uses @msgpack/msgpack library for efficient binary serialization.
   *
   * @template T - The data type to encode
   * @param data - The data to encode
   * @returns MessagePack encoded bytes
   * @throws {EncodeError} If MessagePack encoding fails
   */
  encode<T extends Serializable>(data: T): TransportData {
    try {
      return new Uint8Array(encode(data))
    } catch (error) {
      throw new EncodeError(this.name, error as Error)
    }
  }

  /**
   * Decode MessagePack bytes to data
   *
   * Uses @msgpack/msgpack library for binary deserialization.
   *
   * @template T - The expected data type
   * @param data - The MessagePack bytes to decode
   * @returns Decoded data
   * @throws {DecodeError} If MessagePack decoding fails or data is corrupted
   */
  decode<T extends Serializable>(data: TransportData): T {
    try {
      return decode(Buffer.from(data)) as T
    } catch (error) {
      throw new DecodeError(this.name, error as Error)
    }
  }
}
