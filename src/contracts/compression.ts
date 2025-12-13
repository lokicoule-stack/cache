import type { TransportData } from '../types'

/**
 * Data compression abstraction.
 *
 * @remarks
 * Transforms binary data using compression algorithms (gzip, brotli, etc.).
 * Operations must be reversible: decompress(compress(x)) === x.
 *
 * @public
 */
export interface Compression {
  /** Compression identifier */
  readonly name: string

  /**
   * Compress data
   * @throws \{CompressionError\} on failure
   */
  compress(data: TransportData): Promise<TransportData>

  /**
   * Decompress data
   * @throws \{CompressionError\} on failure or corruption
   */
  decompress(data: TransportData): Promise<TransportData>
}
