import type { Encryption } from '@/contracts/encryption'

/** @public */
export type EncryptionType = 'base64' | 'hmac'

/** @public */
export interface HMACConfig {
  type: 'hmac'
  key: Buffer | string
}

/** @public */
export type EncryptionOption = EncryptionType | HMACConfig | Encryption

/** @public */
export interface EncryptionConfig {
  encryption: EncryptionOption
}

/** @public */
export function isHMACConfig(option: unknown): option is HMACConfig {
  return (
    typeof option === 'object' &&
    option !== null &&
    'type' in option &&
    option.type === 'hmac' &&
    'key' in option
  )
}
