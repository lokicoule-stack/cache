import type { Compression } from '@/core/compression'

/**
 * Compression middleware configuration
 */
export interface CompressionConfig {
  /**
   * Compression implementation to use
   */
  compression: Compression
}

/**
 * Type alias for backwards compatibility
 */
export type CompressionOptions = CompressionConfig
