import type { Serializable, TransportData } from '../types'

/**
 * Codec contract for encoding/decoding messages
 *
 * Provides serialization/deserialization abstraction for message bus.
 * Codecs transform between user-facing Serializable types and binary
 * TransportData for efficient network transmission.
 */
export interface Codec {
  /**
   * Codec identifier name
   *
   * Used for logging, debugging, and error messages.
   *
   * @example 'json', 'msgpack', 'protobuf'
   */
  readonly name: string

  /**
   * Encode data to binary format
   *
   * Serializes user data to Uint8Array for transport layer.
   * Must be deterministic and invertible (decode(encode(x)) === x).
   *
   * @template T - The data type to encode (must extend Serializable)
   * @param data - The data to encode
   * @returns Binary representation of the data
   * @throws {EncodeError} If serialization fails
   *
   * @example
   * ```typescript
   * const bytes = codec.encode({ id: 123, name: 'Alice' })
   * ```
   */
  encode<T extends Serializable>(data: T): TransportData

  /**
   * Decode binary data to original format
   *
   * Deserializes Uint8Array from transport layer back to user data.
   * Must correctly handle data encoded by the same codec.
   *
   * @template T - The expected data type (must extend Serializable)
   * @param data - The binary data to decode
   * @returns Deserialized data
   * @throws {DecodeError} If deserialization fails or data is corrupted
   *
   * @example
   * ```typescript
   * const data = codec.decode<UserEvent>(bytes)
   * ```
   */
  decode<T extends Serializable>(data: TransportData): T
}

/**
 * Supported built-in codec types
 *
 * - `'json'`: Standard JSON serialization (human-readable, larger size)
 * - `'msgpack'`: MessagePack binary serialization (compact, faster)
 */
export type CodecType = 'json' | 'msgpack'

/**
 * Codec option for bus configuration
 *
 * Can be either a predefined codec type string or a custom ICodec implementation.
 * If not specified, defaults to 'json'.
 *
 * @example
 * ```typescript
 * // Using predefined codec
 * const bus = new Bus({ transport, codec: 'msgpack' })
 *
 * // Using custom codec
 * const customCodec: Codec = {
 *   name: 'protobuf',
 *   encode: (data) => ...,
 *   decode: (data) => ...
 * }
 * const bus = new Bus({ transport, codec: customCodec })
 * ```
 */
export type CodecOption = CodecType | Codec
