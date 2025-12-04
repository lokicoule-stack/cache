import type { EncryptionConfig } from './encryption.config'
import type { Encryption } from '@/core/encryption'
import type { Transport } from '@/core/transport'
import type { TransportData, TransportMessageHandler } from '@/core/types'

import { TransportMiddleware } from '@/features/middleware/base'

/**
 * Encryption middleware with pluggable encryption implementations
 *
 * Provides a decorator for Transport that applies encryption/decryption
 * transformations to all published and subscribed messages.
 *
 * The middleware delegates to an Encryption implementation,
 * allowing flexible choice of obfuscation or authentication mechanisms.
 *
 * @example
 * ```typescript
 * import { randomBytes } from 'crypto'
 * import { Base64Encryption, HMACEncryption } from '../../../infrastructure/encryption'
 *
 * // Base64 obfuscation
 * const m1 = new EncryptionMiddleware(transport, {
 *   encryption: new Base64Encryption()
 * })
 *
 * // HMAC integrity verification
 * const key = randomBytes(32)
 * const m2 = new EncryptionMiddleware(transport, {
 *   encryption: new HMACEncryption(key)
 * })
 * ```
 */
export class EncryptionMiddleware extends TransportMiddleware {
  readonly #encryption: Encryption

  constructor(transport: Transport, config: EncryptionConfig) {
    super(transport)
    this.#encryption = config.encryption
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
