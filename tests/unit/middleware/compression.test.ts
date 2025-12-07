import { describe, expect, it } from 'vitest'
import { GzipCompression, CompressionMarker } from '@/infrastructure/compression/gzip-compression'

describe('GzipCompression', () => {
  const compression = new GzipCompression({ threshold: 100 })

  it('skips compression for data below threshold', async () => {
    const small = new Uint8Array(50).fill(65)

    const result = await compression.compress(small)

    expect(result[0]).toBe(CompressionMarker.UNCOMPRESSED)
    expect(result.slice(1)).toEqual(small)
  })

  it('compresses data above threshold', async () => {
    const large = new Uint8Array(200).fill(65)

    const result = await compression.compress(large)

    expect(result[0]).toBe(CompressionMarker.GZIP)
    expect(result.length).toBeLessThan(large.length)
  })

  it('round-trips data correctly', async () => {
    const data = new TextEncoder().encode(JSON.stringify({ key: 'x'.repeat(200) }))

    const compressed = await compression.compress(data)
    const decompressed = await compression.decompress(compressed)

    expect(decompressed).toEqual(data)
  })

  it('skips compression when ratio is poor', async () => {
    const random = new Uint8Array(200)
    crypto.getRandomValues(random)

    const result = await compression.compress(random)

    expect(result[0]).toBe(CompressionMarker.UNCOMPRESSED)
  })
})
