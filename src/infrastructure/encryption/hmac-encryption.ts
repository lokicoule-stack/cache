import { createHmac } from 'node:crypto'

import { EncryptionError, EncryptionErrorCode, EncryptionSecurityError } from './encryption-errors'

import type { Encryption } from '@/contracts/encryption'
import type { TransportData } from '@/types'

/** @internal */
export class HMACEncryption implements Encryption {
  static readonly #SIGNATURE_LENGTH = 32 // SHA-256 = 32 bytes
  
  readonly name = 'hmac'

  readonly #key: Buffer

  constructor(key: Buffer | string) {
    this.#key = typeof key === 'string' ? Buffer.from(key, 'hex') : key
  }

  encrypt(data: TransportData): Uint8Array {
    const hmac = createHmac('sha256', this.#key)

    hmac.update(data)
    const signature = hmac.digest()

    const combined = new Uint8Array(signature.length + data.length)

    combined.set(signature, 0)
    combined.set(data, signature.length)

    return combined
  }

  decrypt(data: Uint8Array): Uint8Array {
    if (data.length < HMACEncryption.#SIGNATURE_LENGTH) {
      throw new EncryptionError(
        'Invalid HMAC data: too short',
        EncryptionErrorCode.INVALID_DATA,
        { context: { operation: 'decrypt', algorithm: 'hmac' } }
      )
    }

    const receivedSignature = data.slice(0, HMACEncryption.#SIGNATURE_LENGTH)
    const payload = data.slice(HMACEncryption.#SIGNATURE_LENGTH)

    const hmac = createHmac('sha256', this.#key)

    hmac.update(payload)
    const expectedSignature = hmac.digest()

    if (!this.#constantTimeCompare(receivedSignature, expectedSignature)) {
      throw new EncryptionSecurityError(
        'HMAC verification failed',
        { context: { operation: 'verify', algorithm: 'hmac' } }
      )
    }

    return payload
  }

  #constantTimeCompare(a: Uint8Array, b: Buffer): boolean {
    if (a.length !== b.length) {
      return false
    }
    let result = 0

    for (let i = 0; i < a.length; i++) {
      result |= a[i] ^ b[i]
    }

    return result === 0
  }
}
