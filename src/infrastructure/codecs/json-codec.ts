import { CodecError, CodecErrorCode } from './codec-errors'

import type { Codec } from '@/contracts/codec'
import type { Serializable, TransportData } from '@/types'

export class JsonCodec implements Codec {
  readonly name = 'json'

  encode<T extends Serializable>(data: T): TransportData {
    try {
      return new TextEncoder().encode(JSON.stringify(data))
    } catch (error) {
      throw new CodecError(
        `Failed to encode data with ${this.name}: ${(error as Error).message}`,
        CodecErrorCode.ENCODE_FAILED,
        {
          cause: error as Error,
          context: { codec: this.name, operation: 'encode' },
        },
      )
    }
  }

  decode<T extends Serializable>(data: TransportData): T {
    try {
      return JSON.parse(new TextDecoder().decode(data)) as T
    } catch (error) {
      throw new CodecError(
        `Failed to decode data with ${this.name}: ${(error as Error).message}`,
        CodecErrorCode.DECODE_FAILED,
        {
          cause: error as Error,
          context: { codec: this.name, operation: 'decode' },
        },
      )
    }
  }
}
