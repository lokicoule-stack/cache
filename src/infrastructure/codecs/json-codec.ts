import { DecodeError, EncodeError } from './codec-errors'

import type { Codec } from '@/contracts/codec'
import type { Serializable, TransportData } from '@/types'

/** @internal */
export class JsonCodec implements Codec {
  readonly name = 'json'

  encode<T extends Serializable>(data: T): TransportData {
    try {
      return new TextEncoder().encode(JSON.stringify(data))
    } catch (error) {
      throw new EncodeError(this.name, error as Error)
    }
  }

  decode<T extends Serializable>(data: TransportData): T {
    try {
      return JSON.parse(new TextDecoder().decode(data)) as T
    } catch (error) {
      throw new DecodeError(this.name, error as Error)
    }
  }
}
