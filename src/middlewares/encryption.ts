import { TransportMiddleware } from './base'

import type { ITransport } from '../types'

/**
 * Encryption middleware
 */
export interface EncryptionOptions {
  /** Encryption key (32 bytes for AES-256) */
  key: Buffer | string
  /** Algorithm (default: aes-256-gcm) */
  algorithm?: string
}

export class EncryptionMiddleware extends TransportMiddleware {
  // #key: Buffer
  // #algorithm: string

  constructor(transport: ITransport, _options: EncryptionOptions) {
    super(transport)

    /* this.#algorithm = options.algorithm ?? 'aes-256-gcm'
    this.#key = typeof options.key === 'string'
      ? Buffer.from(options.key, 'hex')
      : options.key

    if (this.#key.length !== 32) {
      throw new Error('Encryption key must be 32 bytes for AES-256')
    } */
  }

  /* override async publish(channel: string, data: TransportData): Promise<void> {
    // Generate IV (12 bytes for GCM)
    const iv = randomBytes(12)

    // Create cipher
    const cipher = createCipheriv(this.#algorithm, this.#key, iv)

    // Encrypt
    const encrypted = Buffer.concat([
      cipher.update(data),
      cipher.final(),
    ])

    // Get auth tag (for GCM)
    const authTag = cipher.getAuthTag()

    // Combine: [iv(12) + authTag(16) + encrypted]
    const combined = new Uint8Array(iv.length + authTag.length + encrypted.length)
    combined.set(iv, 0)
    combined.set(authTag, iv.length)
    combined.set(encrypted, iv.length + authTag.length)

    await this.transport.publish(channel, combined)
  }

  override async subscribe(channel: string, handler: TransportMessageHandler): Promise<void> {
    return this.transport.subscribe(channel, (data) => {
      // Extract: [iv(12) + authTag(16) + encrypted]
      const iv = data.slice(0, 12)
      const authTag = data.slice(12, 28)
      const encrypted = data.slice(28)

      // Create decipher
      const decipher = createDecipheriv(this.#algorithm, this.#key, iv)
      decipher.setAuthTag(authTag)

      // Decrypt
      const decrypted = Buffer.concat([
        decipher.update(encrypted),
        decipher.final(),
      ])

      handler(new Uint8Array(decrypted))
    })
  } */
}
