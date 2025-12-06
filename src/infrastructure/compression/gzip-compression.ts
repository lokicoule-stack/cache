import { promisify } from 'node:util'
import { gunzip, gzip } from 'node:zlib'

import { CompressionError, CompressionErrorCode } from './compression-errors'

import type { Compression } from '@/contracts/compression'
import type { TransportData } from '@/types'

const gzipAsync = promisify(gzip)
const gunzipAsync = promisify(gunzip)

/** @internal */
export const CompressionMarker = {
  UNCOMPRESSED: 0,
  GZIP: 1,
} as const

/** @internal */
export type CompressionMarkerType = (typeof CompressionMarker)[keyof typeof CompressionMarker]

/** @internal */
export interface GzipCompressionConfig {
  /** Compression level 0-9 (default: 6) */
  level?: number
  /** Minimum size in bytes to trigger compression (default: 1024) */
  threshold?: number
}

const DEFAULT_OPTIONS: Required<GzipCompressionConfig> = {
  level: 6,
  threshold: 1024,
}

/** @internal */
export class GzipCompression implements Compression {
  static readonly #MARKER_SIZE = 1

  readonly name = 'gzip'
  readonly #options: Required<GzipCompressionConfig>

  constructor(options: GzipCompressionConfig = {}) {
    this.#options = { ...DEFAULT_OPTIONS, ...options }
  }

  async compress(data: TransportData): Promise<Uint8Array> {
    const shouldCompress = this.#shouldCompress(data)

    if (!shouldCompress) {
      return this.#prependMarker(CompressionMarker.UNCOMPRESSED, data)
    }

    const compressed = await gzipAsync(data, { level: this.#options.level })

    if (compressed.length >= data.length * 0.9) {
      return this.#prependMarker(CompressionMarker.UNCOMPRESSED, data)
    }

    return this.#prependMarker(CompressionMarker.GZIP, compressed)
  }

  async decompress(data: Uint8Array): Promise<Uint8Array> {
    this.#validateData(data)

    const marker = this.#extractMarker(data)
    const payload = this.#extractPayload(data)

    switch (marker) {
      case CompressionMarker.GZIP:
        return await this.#decompressGzip(payload)

      case CompressionMarker.UNCOMPRESSED:
        return payload

      default: {
        const unknownMarker = marker as number

        throw new CompressionError(
          `Unknown compression marker: ${unknownMarker}`,
          CompressionErrorCode.UNKNOWN_FORMAT,
          {
            context: {
              operation: 'detect',
              algorithm: 'gzip',
              expectedFormat: `${CompressionMarker.GZIP} or ${CompressionMarker.UNCOMPRESSED}`,
              actualFormat: unknownMarker
            }
          }
        )
      }
    }
  }

  #shouldCompress(data: TransportData): boolean {
    return data.length >= this.#options.threshold
  }

  #validateData(data: Uint8Array): void {
    if (data.length < GzipCompression.#MARKER_SIZE) {
      throw new CompressionError(
        'Invalid compressed data: too short',
        CompressionErrorCode.INVALID_DATA,
        { context: { operation: 'decompress', algorithm: 'gzip' } }
      )
    }
  }

  #extractMarker(data: Uint8Array): CompressionMarkerType {
    return data[0] as CompressionMarkerType
  }

  #extractPayload(data: Uint8Array): Uint8Array {
    return data.slice(GzipCompression.#MARKER_SIZE)
  }

  async #decompressGzip(payload: Uint8Array): Promise<Uint8Array> {
    const decompressed = await gunzipAsync(payload)

    return new Uint8Array(decompressed)
  }

  #prependMarker(marker: CompressionMarkerType, payload: Buffer | Uint8Array): Uint8Array {
    const result = new Uint8Array(GzipCompression.#MARKER_SIZE + payload.length)

    result[0] = marker
    result.set(payload, GzipCompression.#MARKER_SIZE)

    return result
  }
}
