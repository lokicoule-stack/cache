import { promisify } from 'node:util'
import { gunzip, gzip } from 'node:zlib'

import type { ICompression } from '@/core/compression'
import type { TransportData } from '@/core/types'

const gzipAsync = promisify(gzip)
const gunzipAsync = promisify(gunzip)

/**
 * Compression format markers
 */
export const CompressionMarker = {
  UNCOMPRESSED: 0,
  GZIP: 1,
} as const

export type CompressionMarkerType = (typeof CompressionMarker)[keyof typeof CompressionMarker]

/**
 * Gzip compression options
 */
export interface GzipCompressionOptions {
  /** Compression level 0-9 (default: 6) */
  level?: number
  /** Minimum size in bytes to trigger compression (default: 1024) */
  threshold?: number
}

const DEFAULT_OPTIONS: Required<GzipCompressionOptions> = {
  level: 6,
  threshold: 1024,
}

/**
 * Gzip compression implementation
 *
 * Handles gzip compression with automatic threshold detection.
 * Only compresses data if it exceeds the threshold and results in size reduction.
 *
 * Message format: [marker(1 byte) || payload(?)]
 * - marker=0: uncompressed
 * - marker=1: gzip compressed
 *
 * @example
 * ```typescript
 * const compression = new GzipCompression({ level: 9, threshold: 2048 })
 *
 * // Compress
 * const compressed = await compression.compress(data)
 *
 * // Decompress
 * const original = await compression.decompress(compressed)
 * ```
 */
export class GzipCompression implements ICompression {
  private static readonly MARKER_SIZE = 1

  readonly #options: Required<GzipCompressionOptions>

  constructor(options: GzipCompressionOptions = {}) {
    this.#options = { ...DEFAULT_OPTIONS, ...options }
  }

  /**
   * Returns the compression threshold in bytes
   */
  get threshold(): number {
    return this.#options.threshold
  }

  /**
   * Returns the compression level (0-9)
   */
  get level(): number {
    return this.#options.level
  }

  /**
   * Compresses data if it exceeds threshold
   *
   * Format: [marker(1) || payload(?)]
   * - marker=0: uncompressed
   * - marker=1: gzip compressed
   *
   * @param data - Data to compress
   * @returns Compressed data with marker
   */
  async compress(data: TransportData): Promise<Uint8Array> {
    const shouldCompress = this.#shouldCompress(data)

    if (!shouldCompress) {
      return this.#prependMarker(CompressionMarker.UNCOMPRESSED, data)
    }

    const compressed = await gzipAsync(data, { level: this.#options.level })

    // Only use compressed version if it's actually smaller (at least 10% reduction)
    if (compressed.length >= data.length * 0.9) {
      return this.#prependMarker(CompressionMarker.UNCOMPRESSED, data)
    }

    return this.#prependMarker(CompressionMarker.GZIP, compressed)
  }

  /**
   * Decompresses data based on marker
   *
   * @param data - Compressed data with marker
   * @returns Original uncompressed data
   * @throws {Error} If data is invalid or marker is unknown
   */
  async decompress(data: Uint8Array): Promise<Uint8Array> {
    this.#validateData(data)

    const marker = this.#extractMarker(data)
    const payload = this.#extractPayload(data)

    switch (marker) {
      case CompressionMarker.GZIP:
        return this.#decompressGzip(payload)

      case CompressionMarker.UNCOMPRESSED:
        return payload

      default:
        throw new Error(`Unknown compression marker: ${marker as number}`)
    }
  }

  /**
   * Checks if data should be compressed
   */
  #shouldCompress(data: TransportData): boolean {
    return data.length >= this.#options.threshold
  }

  /**
   * Validates compressed data structure
   */
  #validateData(data: Uint8Array): void {
    if (data.length < GzipCompression.MARKER_SIZE) {
      throw new Error('Invalid compressed data: too short')
    }
  }

  /**
   * Extracts compression marker from data
   */
  #extractMarker(data: Uint8Array): CompressionMarkerType {
    return data[0] as CompressionMarkerType
  }

  /**
   * Extracts payload from data (removes marker)
   */
  #extractPayload(data: Uint8Array): Uint8Array {
    return data.slice(GzipCompression.MARKER_SIZE)
  }

  /**
   * Decompresses gzip data
   */
  async #decompressGzip(payload: Uint8Array): Promise<Uint8Array> {
    const decompressed = await gunzipAsync(payload)

    return new Uint8Array(decompressed)
  }

  /**
   * Prepends a marker byte to the payload
   */
  #prependMarker(marker: CompressionMarkerType, payload: Buffer | Uint8Array): Uint8Array {
    const result = new Uint8Array(GzipCompression.MARKER_SIZE + payload.length)

    result[0] = marker
    result.set(payload, GzipCompression.MARKER_SIZE)

    return result
  }
}
