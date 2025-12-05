import type { Encryption } from '@/contracts/encryption'

/**
 * Built-in encryption types
 */
export type EncryptionType = 'base64' | 'hmac'

/**
 * HMAC encryption configuration
 */
export interface HMACConfig {
  type: 'hmac'
  key: Buffer | string
}

/**
 * Encryption option: magic string, config object, or custom implementation
 */
export type EncryptionOption = EncryptionType | HMACConfig | Encryption

/**
 * Encryption middleware configuration
 */
export interface EncryptionConfig {
  encryption: EncryptionOption
}

/**
 * Type guard to check if option is HMACConfig
 */
export function isHMACConfig(option: unknown): option is HMACConfig {
  return (
    typeof option === 'object' &&
    option !== null &&
    'type' in option &&
    option.type === 'hmac' &&
    'key' in option
  )
}
