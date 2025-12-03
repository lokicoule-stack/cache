import type { IEncryption } from '../../../core/encryption'

/**
 * Encryption middleware configuration
 */
export interface EncryptionConfig {
  /**
   * Encryption implementation to use
   */
  encryption: IEncryption
}

/**
 * Type alias for backwards compatibility
 */
export type EncryptionOptions = EncryptionConfig
