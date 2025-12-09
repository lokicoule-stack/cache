import type { Serializable, TransportData } from '../types'

/**
 * Serialization/deserialization abstraction.
 *
 * @remarks
 * Transforms between Serializable types and binary TransportData.
 * Must be deterministic: decode(encode(x)) === x.
 *
 * @public
 */
export interface Codec {
  /** Codec identifier */
  readonly name: string

  /**
   * Serialize to binary
   * @throws \{EncodeError\} on failure
   */
  encode<T extends Serializable>(data: T): TransportData

  /**
   * Deserialize from binary
   * @throws \{DecodeError\} on failure or corruption
   */
  decode<T extends Serializable>(data: TransportData): T
}

/** @public */
export type CodecType = 'json' | 'msgpack' | 'auto'

/**
 * Configuration for AutoCodec behavior.
 * @public
 */
export interface AutoCodecConfig {
  type: 'auto'
  /**
   * Size threshold in bytes (default: 500)
   * - Payloads < threshold: JSON (faster parsing)
   * - Payloads ≥ threshold: MessagePack (smaller size)
   */
  threshold?: number
}

/** @public */
export type CodecOption = CodecType | AutoCodecConfig | Codec
