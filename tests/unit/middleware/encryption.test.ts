import { describe, expect, it } from 'vitest'
import { Base64Encryption } from '@/infrastructure/encryption/base64-encryption'
import { HMACEncryption } from '@/infrastructure/encryption/hmac-encryption'
import { EncryptionSecurityError } from '@/infrastructure/encryption/encryption-errors'

describe('Encryption', () => {
  const data = new TextEncoder().encode('secret message')

  describe('Base64Encryption', () => {
    const encryption = new Base64Encryption()

    it('round-trips data correctly', () => {
      const encrypted = encryption.encrypt(data)
      const decrypted = encryption.decrypt(encrypted)

      expect(decrypted).toEqual(data)
    })
  })

  describe('HMACEncryption', () => {
    const key = Buffer.from('0'.repeat(64), 'hex')
    const encryption = new HMACEncryption(key)

    it('round-trips data with valid signature', () => {
      const encrypted = encryption.encrypt(data)
      const decrypted = encryption.decrypt(encrypted)

      expect(decrypted).toEqual(data)
    })

    it('rejects tampered data', () => {
      const encrypted = encryption.encrypt(data)
      encrypted[0] ^= 0xff

      expect(() => encryption.decrypt(encrypted)).toThrow(EncryptionSecurityError)
    })

    it('rejects truncated data', () => {
      const tooShort = new Uint8Array(16)

      expect(() => encryption.decrypt(tooShort)).toThrow('too short')
    })
  })
})
