import { createHmac } from 'node:crypto'

import { HMACVerificationError, InvalidEncryptionDataError } from './encryption-errors'

import type { Encryption } from '@/contracts/encryption'
import type { TransportData } from '@/types'

/**
 * HMAC-SHA256 authentication (integrity verification)
 *
 * Provides message authentication using HMAC-SHA256.
 * Ensures message integrity and authenticity with a shared secret key.
 * Uses constant-time comparison to prevent timing attacks.
 *
 * Message format: [signature(32 bytes) || original data]
 *
 * @example
 * ```typescript
 * import { randomBytes } from 'crypto'
 *
 * const key = randomBytes(32)
 * const encryption = new HMACEncryption(key)
 *
 * // Publishing side
 * const encrypted = encryption.encrypt(data)
 *
 * // Subscribing side (with same key)
 * const decrypted = encryption.decrypt(encrypted) // Throws if HMAC invalid
 * ```
 */
export class HMACEncryption implements Encryption {
  private static readonly SIGNATURE_LENGTH = 32 // SHA-256 = 32 bytes

  readonly #key: Buffer

  /**
   * Create HMAC encryption with secret key
   *
   * @param key - Secret key (Buffer or hex-encoded string)
   */
  constructor(key: Buffer | string) {
    this.#key = typeof key === 'string' ? Buffer.from(key, 'hex') : key
  }

  encrypt(data: TransportData): Uint8Array {
    const hmac = createHmac('sha256', this.#key)

    hmac.update(data)
    const signature = hmac.digest()

    // Format: [signature(32) || data]
    const combined = new Uint8Array(signature.length + data.length)

    combined.set(signature, 0)
    combined.set(data, signature.length)

    return combined
  }

  decrypt(data: Uint8Array): Uint8Array {
    if (data.length < HMACEncryption.SIGNATURE_LENGTH) {
      throw new InvalidEncryptionDataError('Invalid HMAC data: too short')
    }

    // Extract signature and payload
    const receivedSignature = data.slice(0, HMACEncryption.SIGNATURE_LENGTH)
    const payload = data.slice(HMACEncryption.SIGNATURE_LENGTH)

    // Verify HMAC
    const hmac = createHmac('sha256', this.#key)

    hmac.update(payload)
    const expectedSignature = hmac.digest()

    if (!this.#constantTimeCompare(receivedSignature, expectedSignature)) {
      throw new HMACVerificationError()
    }

    return payload
  }

  /**
   * Constant-time comparison to prevent timing attacks
   *
   * @param a - First buffer
   * @param b - Second buffer
   * @returns True if buffers are equal
   */
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
