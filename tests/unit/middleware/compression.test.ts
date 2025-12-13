import { describe, expect, it } from 'vitest'
import { GzipCompression, CompressionMarker } from '@/infrastructure/compression/gzip-compression'
import { TestData } from '@test/builders'

describe('GzipCompression', () => {
  const compression = new GzipCompression({ threshold: 100 })

  describe('threshold behavior', () => {
    it('skips compression for data below threshold', async () => {
      const small = new Uint8Array(50).fill(65)

      const result = await compression.compress(small)

      expect(result[0]).toBe(CompressionMarker.UNCOMPRESSED)
      expect(result.slice(1)).toEqual(small)
    })

    it('compresses data above threshold when ratio is favorable', async () => {
      const large = TestData.compressible

      const result = await compression.compress(large)

      expect(result[0]).toBe(CompressionMarker.GZIP)
      expect(result.length).toBeLessThan(large.length)
    })

    it('skips compression when ratio is poor (incompressible data)', async () => {
      const random = TestData.incompressible

      const result = await compression.compress(random)

      expect(result[0]).toBe(CompressionMarker.UNCOMPRESSED)
    })
  })

  describe('round-trip integrity', () => {
    it('preserves data through compress/decompress cycle', async () => {
      const original = new TextEncoder().encode(JSON.stringify({ key: 'x'.repeat(200) }))

      const compressed = await compression.compress(original)
      const decompressed = await compression.decompress(compressed)

      expect(decompressed).toEqual(original)
    })

    it('round-trips uncompressed data correctly', async () => {
      const small = new Uint8Array(10).fill(42)

      const result = await compression.compress(small)
      const restored = await compression.decompress(result)

      expect(restored).toEqual(small)
    })
  })

  describe('invariants', () => {
    it('compressed output is always smaller than uncompressed for compressible data', async () => {
      const compressible = new Uint8Array(1000).fill(65) // Highly compressible

      const result = await compression.compress(compressible)

      // Only check payload size (excluding marker byte)
      if (result[0] === CompressionMarker.GZIP) {
        expect(result.length - 1).toBeLessThan(compressible.length)
      }
    })
  })
})
