import { createHmac, timingSafeEqual } from 'node:crypto'

import { IntegrityError, IntegrityErrorCode, IntegritySecurityError } from './integrity-errors'

import type { Integrity } from '@/contracts/integrity'
import type { TransportData } from '@/types'

import debug from '@/debug'

export class HMACIntegrity implements Integrity {
  static readonly #SIGNATURE_LENGTH = 32 // SHA-256 = 32 bytes

  readonly name = 'hmac'

  readonly #key: Buffer

  constructor(key: Buffer | string) {
    this.#key = typeof key === 'string' ? Buffer.from(key, 'hex') : key
  }

  sign(data: TransportData): TransportData {
    const hmac = createHmac('sha256', this.#key)

    hmac.update(data)
    const signature = hmac.digest()

    const combined = new Uint8Array(signature.length + data.length)

    combined.set(signature, 0)
    combined.set(data, signature.length)

    return combined
  }

  verify(data: TransportData): TransportData {
    if (data.length < HMACIntegrity.#SIGNATURE_LENGTH) {
      throw new IntegrityError('Invalid HMAC data: too short', IntegrityErrorCode.INVALID_DATA, {
        context: { operation: 'verify', algorithm: 'hmac' },
      })
    }

    const receivedSignature = data.slice(0, HMACIntegrity.#SIGNATURE_LENGTH)
    const payload = data.slice(HMACIntegrity.#SIGNATURE_LENGTH)

    const hmac = createHmac('sha256', this.#key)

    hmac.update(payload)
    const expectedSignature = hmac.digest()

    if (!this.#constantTimeCompare(receivedSignature, expectedSignature)) {
      debug('[ERROR] HMAC verification failed:', {
        severity: 'SECURITY',
        algorithm: 'hmac',
      })

      throw new IntegritySecurityError('HMAC verification failed', {
        context: { operation: 'verify', algorithm: 'hmac' },
      })
    }

    return payload
  }

  #constantTimeCompare(a: Uint8Array, b: Buffer): boolean {
    if (a.length !== b.length) {
      const maxLen = Math.max(a.length, b.length)
      const aPadded = Buffer.alloc(maxLen)
      const bPadded = Buffer.alloc(maxLen)

      aPadded.set(a)
      bPadded.set(b)

      return timingSafeEqual(aPadded, bPadded)
    }

    return timingSafeEqual(a, b)
  }
}
