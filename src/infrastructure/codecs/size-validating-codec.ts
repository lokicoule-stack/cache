import { CodecError, CodecErrorCode } from './codec-errors'

import type { Codec } from '@/contracts/codec'
import type { Serializable, TransportData } from '@/types'

/**
 * Default maximum payload size: 10MB
 */
export const DEFAULT_MAX_PAYLOAD_SIZE = 10 * 1024 * 1024

/**
 * Codec wrapper that validates payload sizes to prevent DoS attacks.
 *
 * @internal
 */
export class SizeValidatingCodec implements Codec {
  readonly name: string
  readonly #innerCodec: Codec
  readonly #maxPayloadSize: number

  constructor(innerCodec: Codec, maxPayloadSize: number = DEFAULT_MAX_PAYLOAD_SIZE) {
    this.#innerCodec = innerCodec
    this.#maxPayloadSize = maxPayloadSize
    this.name = `${innerCodec.name}-with-size-validation`
  }

  encode<T extends Serializable>(data: T): TransportData {
    const encoded = this.#innerCodec.encode(data)

    if (encoded.length > this.#maxPayloadSize) {
      throw new CodecError(
        `Payload size ${encoded.length} bytes exceeds maximum allowed size of ${
          this.#maxPayloadSize
        } bytes`,
        CodecErrorCode.PAYLOAD_TOO_LARGE,
        {
          context: {
            codec: this.#innerCodec.name,
            operation: 'encode',
            payloadSize: encoded.length,
            maxPayloadSize: this.#maxPayloadSize,
          },
        },
      )
    }

    return encoded
  }

  decode<T extends Serializable>(data: TransportData): T {
    if (data.length > this.#maxPayloadSize) {
      throw new CodecError(
        `Payload size ${data.length} bytes exceeds maximum allowed size of ${
          this.#maxPayloadSize
        } bytes`,
        CodecErrorCode.PAYLOAD_TOO_LARGE,
        {
          context: {
            codec: this.#innerCodec.name,
            operation: 'decode',
            payloadSize: data.length,
            maxPayloadSize: this.#maxPayloadSize,
          },
        },
      )
    }

    return this.#innerCodec.decode(data)
  }
}
