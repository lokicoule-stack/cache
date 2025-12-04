import type { TransportData } from '../types'

/**
 * Compression interface for transforming transport data
 *
 * Defines the contract for compressing/decompressing transport data.
 * Implementations can provide various compression algorithms (gzip, brotli, etc.).
 *
 * @example
 * ```typescript
 * class MyCompression implements Compression {
 *   async compress(data: TransportData): Promise<Uint8Array> {
 *     // Compress data
 *     return compressed
 *   }
 *
 *   async decompress(data: Uint8Array): Promise<Uint8Array> {
 *     // Decompress data
 *     return original
 *   }
 * }
 * ```
 */
export interface Compression {
  /**
   * Compress data before publishing
   *
   * @param data - Original transport data
   * @returns Compressed data
   * @throws {Error} If compression fails
   */
  compress(data: TransportData): Promise<Uint8Array>

  /**
   * Decompress data after receiving
   *
   * @param data - Compressed data
   * @returns Original transport data
   * @throws {Error} If decompression fails
   */
  decompress(data: Uint8Array): Promise<Uint8Array>
}
