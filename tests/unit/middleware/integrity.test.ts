import { describe, expect, it } from 'vitest'
import { HMACIntegrity } from '@/infrastructure/integrity/hmac-integrity'
import { IntegritySecurityError } from '@/infrastructure/integrity/integrity-errors'
import { TestData } from '@test/builders'

describe('HMACIntegrity', () => {
  const key = Buffer.from('0'.repeat(64), 'hex')
  const integrity = new HMACIntegrity(key)

  describe('signing and verification', () => {
    it('round-trips data with valid signature', () => {
      const signed = integrity.sign(TestData.small)
      const verified = integrity.verify(signed)

      expect(verified).toEqual(TestData.small)
    })

    it('accepts messages signed with same key', () => {
      const message = new TextEncoder().encode('important message')
      const signed = integrity.sign(message)

      expect(() => integrity.verify(signed)).not.toThrow()
    })
  })

  describe('tamper detection', () => {
    it('rejects data with modified payload', () => {
      const signed = integrity.sign(TestData.small)
      signed[signed.length - 1] ^= 0xff // Flip bits in payload

      expect(() => integrity.verify(signed)).toThrow(IntegritySecurityError)
    })

    it('rejects data with modified signature', () => {
      const signed = integrity.sign(TestData.small)
      signed[0] ^= 0xff // Flip bits in signature

      expect(() => integrity.verify(signed)).toThrow(IntegritySecurityError)
    })

    it('rejects truncated data', () => {
      const tooShort = new Uint8Array(16)

      expect(() => integrity.verify(tooShort)).toThrow('too short')
    })
  })

  describe('security invariants', () => {
    it('different messages produce different signatures', () => {
      const msg1 = new TextEncoder().encode('message1')
      const msg2 = new TextEncoder().encode('message2')

      const signed1 = integrity.sign(msg1)
      const signed2 = integrity.sign(msg2)

      // Signatures should differ (first 32 bytes)
      const sig1 = signed1.slice(0, 32)
      const sig2 = signed2.slice(0, 32)
      expect(sig1).not.toEqual(sig2)
    })

    it('same message always produces same signature', () => {
      const message = new TextEncoder().encode('deterministic')

      const signed1 = integrity.sign(message)
      const signed2 = integrity.sign(message)

      expect(signed1).toEqual(signed2)
    })
  })
})
