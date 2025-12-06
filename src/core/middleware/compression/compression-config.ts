import type { Compression } from '@/contracts/compression'

/**
 * Built-in compression types
 */
export type CompressionType = 'gzip'

/**
 * Gzip compression configuration
 *
 * Supports both formats:
 * - `{ type: 'gzip', level?: number, threshold?: number }`
 * - `{ level?: number, threshold?: number }` (type is optional)
 */
export type GzipConfig =
  | {
      type: 'gzip'
      /** Compression level 0-9 (default: 6) */
      level?: number
      /** Minimum size in bytes to trigger compression (default: 1024) */
      threshold?: number
    }
  | {
      /** Compression level 0-9 (default: 6) */
      level?: number
      /** Minimum size in bytes to trigger compression (default: 1024) */
      threshold?: number
    }

/**
 * Compression option: magic string, config object, or custom implementation
 *
 * Supports multiple formats:
 * - `'gzip'`: Default gzip compression
 * - `true`: Default gzip compression (same as 'gzip')
 * - `{ type: 'gzip', level?: number, threshold?: number }`: Gzip with type
 * - `{ level?: number, threshold?: number }`: Gzip without type field
 * - Custom Compression implementation
 */
export type CompressionOption =
  | CompressionType
  | GzipConfig
  | Compression
  | boolean

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
