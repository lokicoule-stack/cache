import type { TransportData } from '../types'

/**
 * Message integrity and authentication abstraction.
 *
 * @remarks
 * Ensures message authenticity and detects tampering through cryptographic signatures.
 * Unlike encryption, data remains readable but is protected against modification.
 *
 * Common use cases:
 * - HMAC: Shared secret authentication
 * - Digital signatures: Public key authentication
 *
 * Note: Integrity does NOT provide confidentiality. Use encryption for data privacy.
 *
 * @public
 */
export interface Integrity {
  /** Integrity mechanism identifier (e.g., 'hmac', 'ed25519') */
  readonly name: string

  /**
   * Sign data with authentication tag
   * @param data - Original data to sign
   * @returns Signed data (typically: signature + data)
   * @throws \{IntegrityError\} on signing failure
   */
  sign(data: TransportData): TransportData

  /**
   * Verify signature and extract original data
   * @param data - Signed data
   * @returns Original data if signature is valid
   * @throws \{IntegrityError\} on verification failure (tampering detected)
   */
  verify(data: TransportData): TransportData
}
