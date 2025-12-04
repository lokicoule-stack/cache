import type { ICompression } from '@/core/compression'

/**
 * Compression middleware configuration
 */
export interface CompressionConfig {
  /**
   * Compression implementation to use
   */
  compression: ICompression
}

/**
 * Type alias for backwards compatibility
 */
export type CompressionOptions = CompressionConfig
