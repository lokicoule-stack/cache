import type { IEncryption } from '@/core/encryption'
import type { TransportData } from '@/core/types'

/**
 * Base64 encoding (obfuscation only, NOT secure)
 *
 * Provides basic Base64 encoding/decoding for transport data.
 * This is NOT encryption - it only provides obfuscation.
 * Do not use for security-sensitive data.
 *
 * @example
 * ```typescript
 * const encryption = new Base64Encryption()
 * const encrypted = encryption.encrypt(data)
 * const decrypted = encryption.decrypt(encrypted)
 * ```
 */
export class Base64Encryption implements IEncryption {
  encrypt(data: TransportData): Uint8Array {
    const base64 = Buffer.from(data).toString('base64')
    return new Uint8Array(Buffer.from(base64, 'utf8'))
  }

  decrypt(data: Uint8Array): Uint8Array {
    const base64String = Buffer.from(data).toString('utf8')
    return new Uint8Array(Buffer.from(base64String, 'base64'))
  }
}
