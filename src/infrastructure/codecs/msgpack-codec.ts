import { decode, encode } from '@msgpack/msgpack'

import { DecodeError, EncodeError } from './codec-errors'

import type { Codec } from '@/contracts/codec'
import type { Serializable, TransportData } from '@/types'

/** @internal */
export class MsgPackCodec implements Codec {
  readonly name = 'msgpack'

  encode<T extends Serializable>(data: T): TransportData {
    try {
      return new Uint8Array(encode(data))
    } catch (error) {
      throw new EncodeError(this.name, error as Error)
    }
  }

  decode<T extends Serializable>(data: TransportData): T {
    try {
      return decode(Buffer.from(data)) as T
    } catch (error) {
      throw new DecodeError(this.name, error as Error)
    }
  }
}
