import { TransportMiddleware } from '../base'

import { isHMACConfig, type EncryptionConfig, type EncryptionOption } from './encryption-config'

import type { Encryption } from '@/contracts/encryption'
import type { Transport } from '@/contracts/transport'
import type { TransportData, TransportMessageHandler } from '@/types'

import { Base64Encryption } from '@/infrastructure/encryption/base64-encryption'
import { EncryptionConfigError } from '@/infrastructure/encryption/encryption-errors'
import { HMACEncryption } from '@/infrastructure/encryption/hmac-encryption'

/**
 * @internal
 */
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

  #resolveEncryption(option: EncryptionOption): Encryption {
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

    return option
  }
}
