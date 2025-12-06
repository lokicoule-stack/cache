import type { TransportData } from '../types'

/**
 * Data encryption/obfuscation abstraction.
 *
 * @remarks
 * Transforms binary data using encryption, obfuscation, or authentication mechanisms.
 * Operations must be reversible: decrypt(encrypt(x)) === x.
 *
 * @public
 */
export interface Encryption {
  /** Encryption identifier */
  readonly name: string

  /**
   * Encrypt data
   * @throws {EncryptionError} on failure
   */
  encrypt(data: TransportData): Uint8Array

  /**
   * Decrypt data
   * @throws {EncryptionError} on failure or verification failure
   */
  decrypt(data: Uint8Array): Uint8Array
}
