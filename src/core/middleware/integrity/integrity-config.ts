/**
 * HMAC integrity configuration
 * @public
 */
export interface HMACConfig {
  type: 'hmac'
  /** HMAC key (hex string or Buffer) - minimum 32 characters for security */
  key: string | Buffer
}

/**
 * Integrity mechanism type
 * @public
 */
export type IntegrityType = 'hmac'

/**
 * Integrity configuration options
 * @public
 */
export type IntegrityOption = HMACConfig

/**
 * Integrity middleware configuration
 * @public
 */
export interface IntegrityConfig {
  integrity: IntegrityOption
}
