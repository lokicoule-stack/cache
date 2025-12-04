import type { Encryption } from '@/core/encryption'

/**
 * Encryption middleware configuration
 */
export interface EncryptionConfig {
  /**
   * Encryption implementation to use
   */
  encryption: Encryption
}

/**
 * Type alias for backwards compatibility
 */
export type EncryptionOptions = EncryptionConfig
