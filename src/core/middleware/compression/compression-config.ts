import type { Compression } from '@/contracts/compression'

/**
 * Built-in compression algorithm types.
 * @public
 */
export type CompressionType = 'gzip'

/**
 * Configuration for gzip compression.
 * @public
 */
export type GzipConfig =
  | {
      type: 'gzip'
      /** Compression level 0-9 (default: 6) */
      level?: number
      /** Minimum size in bytes (default: 5120 = 5KB) */
      threshold?: number
    }
  | {
      /** Compression level 0-9 (default: 6) */
      level?: number
      /** Minimum size in bytes (default: 5120 = 5KB) */
      threshold?: number
    }

/**
 * Compression configuration option - can be a type string, config object, custom implementation, or boolean.
 * @public
 */
export type CompressionOption = CompressionType | GzipConfig | Compression | boolean

/** @public */
export interface CompressionConfig {
  compression: CompressionOption
}

/** @public */
export function isGzipConfig(option: CompressionOption): option is GzipConfig {
  return typeof option === 'object' && option !== null && 'type' in option && option.type === 'gzip'
}
