import type { Codec } from '@/contracts/codec'
import type { Serializable, TransportData } from '@/types'

/**
 * @internal
 */
export class Base64Codec implements Codec {
  readonly name = 'base64'

  encode<T extends Serializable>(data: T): Uint8Array {
    const bytes = data as unknown as TransportData
    const base64 = Buffer.from(bytes).toString('base64')

    return new Uint8Array(Buffer.from(base64, 'utf8'))
  }

  decode<T extends Serializable>(data: TransportData): T {
    const base64String = Buffer.from(data).toString('utf8')

    return new Uint8Array(Buffer.from(base64String, 'base64')) as unknown as T
  }
}
