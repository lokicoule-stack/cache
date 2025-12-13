import { Base64Encryption } from './base64-encryption'
import { EncryptionConfigError } from './encryption-errors'
import { HMACEncryption } from './hmac-encryption'

import type { Encryption } from '@/contracts/encryption'

import { type EncryptionOption, isHMACConfig } from '@/core/middleware/encryption/encryption-config'

function isCustomEncryption(option: unknown): option is Encryption {
  return typeof option === 'object' && option !== null && 'encrypt' in option && 'decrypt' in option
}

/**
 * @public
 */
export function createEncryption(option: EncryptionOption): Encryption {
  if (typeof option === 'string') {
    switch (option) {
      case 'base64':
        return new Base64Encryption()
      case 'hmac':
        throw new EncryptionConfigError(
          'HMAC encryption requires a key. Use { type: "hmac", key: "..." } instead.',
        )
    }
  }

  if (isHMACConfig(option)) {
    return new HMACEncryption(option.key)
  }

  if (isCustomEncryption(option)) {
    return option
  }

  return new Base64Encryption()
}
