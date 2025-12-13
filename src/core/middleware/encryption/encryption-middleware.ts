import { TransportMiddleware } from '../base'

import type { EncryptionConfig } from './encryption-config'
import type { Encryption } from '@/contracts/encryption'
import type { Transport } from '@/contracts/transport'
import type { TransportData, TransportMessageHandler } from '@/types'

import { createEncryption } from '@/infrastructure/encryption'

/**
 * @internal
 */
export class EncryptionMiddleware extends TransportMiddleware {
  readonly #encryption: Encryption

  constructor(transport: Transport, config: EncryptionConfig) {
    super(transport)
    this.#encryption = createEncryption(config.encryption)
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
}
