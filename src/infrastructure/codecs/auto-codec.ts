import { DecodeError } from './codec-errors'
import { JsonCodec } from './json-codec'
import { MsgPackCodec } from './msgpack-codec'

import type { Codec } from '@/contracts/codec'
import type { Serializable, TransportData } from '@/types'

/**
 * Automatically selects JSON or MessagePack encoding based on payload size.
 *
 * Uses JSON for payloads <500 bytes (faster), MessagePack otherwise (smaller).
 * Adds 1-byte prefix: 0x01 (JSON) or 0x02 (MessagePack).
 */
export class AutoCodec implements Codec {
  readonly name = 'auto'
  readonly #jsonCodec = new JsonCodec()
  readonly #msgpackCodec = new MsgPackCodec()
  readonly #threshold: number
  readonly #MARKER_JSON = 0x01
  readonly #MARKER_MSGPACK = 0x02

  /**
   * @param threshold Size threshold in bytes (default: 500)
   */
  constructor(threshold = 500) {
    this.#threshold = threshold
  }

  encode<T extends Serializable>(data: T): TransportData {
    const jsonEncoded = this.#jsonCodec.encode(data)

    if (jsonEncoded.length < this.#threshold) {
      return this.#withMarker(jsonEncoded, this.#MARKER_JSON)
    }

    const msgpackEncoded = this.#msgpackCodec.encode(data)

    return this.#withMarker(msgpackEncoded, this.#MARKER_MSGPACK)
  }

  decode<T extends Serializable>(data: TransportData): T {
    const marker = data[0]
    const payload = data.slice(1)

    if (marker === this.#MARKER_JSON) {
      return this.#jsonCodec.decode<T>(payload)
    }

    if (marker === this.#MARKER_MSGPACK) {
      return this.#msgpackCodec.decode<T>(payload)
    }

    throw new DecodeError(
      this.name,
      new Error(`Unknown encoding marker: 0x${marker?.toString(16) ?? 'undefined'}`),
    )
  }

  #withMarker(encoded: TransportData, marker: number): TransportData {
    const result = new Uint8Array(encoded.length + 1)

    result[0] = marker
    result.set(encoded, 1)

    return result
  }
}
