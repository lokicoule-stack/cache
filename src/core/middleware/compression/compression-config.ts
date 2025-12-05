import type { Compression } from '@/contracts/compression'

/**
 * Built-in compression types
 */
export type CompressionType = 'gzip'

/**
 * Gzip compression configuration
 */
export interface GzipConfig {
  type: 'gzip'
  /** Compression level 0-9 (default: 6) */
  level?: number
  /** Minimum size in bytes to trigger compression (default: 1024) */
  threshold?: number
}

/**
 * Compression option: magic string, config object, or custom implementation
 */
export type CompressionOption = CompressionType | GzipConfig | Compression

/**
 * Compression middleware configuration
 */
export interface CompressionConfig {
  compression: CompressionOption
}

/**
 * Type guard to check if option is GzipConfig
 */
export function isGzipConfig(option: CompressionOption): option is GzipConfig {
  return (
    typeof option === 'object' &&
    option !== null &&
    'type' in option &&
    option.type === 'gzip'
  )
}
