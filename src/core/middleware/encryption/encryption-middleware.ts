import { TransportMiddleware } from '../base'

import { isHMACConfig ,type  EncryptionConfig,type  EncryptionOption } from './encryption-config'

import type { Encryption } from '@/contracts/encryption'
import type { Transport } from '@/contracts/transport'
import type { TransportData, TransportMessageHandler } from '@/types'

import { Base64Encryption } from '@/infrastructure/encryption/base64-encryption'
import { HMACEncryption } from '@/infrastructure/encryption/hmac-encryption'

export class EncryptionMiddleware extends TransportMiddleware {
  readonly #encryption: Encryption

  constructor(transport: Transport, config: EncryptionConfig) {
    super(transport)
    this.#encryption = this.#resolveEncryption(config.encryption)
  }

  override async publish(channel: string, data: TransportData): Promise<void> {
    const encrypted = this.#encryption.encrypt(data)

    await this.transport.publish(channel, encrypted)
  }

  override async subscribe(channel: string, handler: TransportMessageHandler): Promise<void> {
    return this.transport.subscribe(channel, (encryptedData: TransportData) => {
      const decrypted = this.#encryption.decrypt(encryptedData)

      handler(decrypted)
    })
  }

  /**
   * Resolve encryption option to concrete implementation
   *
   * @param option - Encryption option (magic string, config, or implementation)
   * @returns Resolved encryption implementation
   */
  #resolveEncryption(option: EncryptionOption): Encryption {
    // Handle magic strings
    if (typeof option === 'string') {
      switch (option) {
        case 'base64':
          return new Base64Encryption()
        case 'hmac':
          throw new Error('HMAC encryption requires a key. Use { type: "hmac", key: "..." } instead.')
      }
    }

    // Handle HMAC config object (discriminated union)
    if (isHMACConfig(option)) {
      return new HMACEncryption(option.key)
    }

    // Direct Encryption interface injection
    return option
  }
}
