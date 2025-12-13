import { describe, expect, it } from 'vitest'
import { Base64Codec } from '@/infrastructure/codecs/base64-codec'
import { HMACIntegrity } from '@/infrastructure/integrity/hmac-integrity'
import { IntegritySecurityError } from '@/infrastructure/integrity/integrity-errors'
import type { Serializable } from '@/types'

describe('Integrity', () => {
  const data = new TextEncoder().encode('secret message')

  describe('Base64Codec', () => {
    const codec = new Base64Codec()

    it('round-trips data correctly', () => {
      const encoded = codec.encode(data as unknown as Serializable)
      const decoded = codec.decode(encoded)

      expect(decoded).toEqual(data)
    })
  })

  describe('HMACIntegrity', () => {
    const key = Buffer.from('0'.repeat(64), 'hex')
    const integrity = new HMACIntegrity(key)

    it('round-trips data with valid signature', () => {
      const signed = integrity.sign(data)
      const verified = integrity.verify(signed)

      expect(verified).toEqual(data)
    })

    it('rejects tampered data', () => {
      const signed = integrity.sign(data)
      signed[0] ^= 0xff

      expect(() => integrity.verify(signed)).toThrow(IntegritySecurityError)
    })

    it('rejects truncated data', () => {
      const tooShort = new Uint8Array(16)

      expect(() => integrity.verify(tooShort)).toThrow('too short')
    })
  })
})
