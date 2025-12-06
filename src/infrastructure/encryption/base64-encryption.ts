import type { Encryption } from '@/contracts/encryption'
import type { TransportData } from '@/types'

/** @internal */
export class Base64Encryption implements Encryption {
  readonly name = 'base64'

  encrypt(data: TransportData): Uint8Array {
    const base64 = Buffer.from(data).toString('base64')

    return new Uint8Array(Buffer.from(base64, 'utf8'))
  }

  decrypt(data: Uint8Array): Uint8Array {
    const base64String = Buffer.from(data).toString('utf8')

    return new Uint8Array(Buffer.from(base64String, 'base64'))
  }
}
