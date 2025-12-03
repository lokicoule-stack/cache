import type { TransportData } from '../types'

/**
 * Encryption interface for transforming transport data
 *
 * Defines the contract for encrypting/decrypting or obfuscating transport data.
 * Implementations can provide various encryption, obfuscation,
 * or authentication mechanisms.
 *
 * @example
 * ```typescript
 * class MyEncryption implements IEncryption {
 *   encrypt(data: TransportData): Uint8Array {
 *     // Transform data
 *     return transformed
 *   }
 *
 *   decrypt(data: Uint8Array): Uint8Array {
 *     // Reverse transformation
 *     return original
 *   }
 * }
 * ```
 */
export interface IEncryption {
  /**
   * Encrypt/transform data before publishing
   *
   * @param data - Original transport data
   * @returns Transformed data
   * @throws {Error} If encryption fails
   */
  encrypt(data: TransportData): Uint8Array

  /**
   * Decrypt/reverse data after receiving
   *
   * @param data - Transformed data
   * @returns Original transport data
   * @throws {Error} If decryption/verification fails
   */
  decrypt(data: Uint8Array): Uint8Array
}
