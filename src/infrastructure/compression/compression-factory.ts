import { GzipCompression } from './gzip-compression'

import type { Compression } from '@/contracts/compression'

import {
  type CompressionOption,
  isGzipConfig,
} from '@/core/middleware/compression/compression-config'

function isCustomCompression(option: unknown): option is Compression {
  return (
    typeof option === 'object' && option !== null && 'compress' in option && 'decompress' in option
  )
}

/**
 * Creates a compression instance from the given option.
 *
 * @param option - The compression option ('gzip', config object, or custom compression instance)
 * @returns The resolved compression instance
 *
 * @public
 */
export function createCompression(option?: CompressionOption): Compression {
  if (!option) {
    return new GzipCompression()
  }

  if (typeof option === 'boolean') {
    return new GzipCompression()
  }

  if (typeof option === 'string') {
    switch (option) {
      case 'gzip':
        return new GzipCompression()
    }
  }

  if (isGzipConfig(option)) {
    return new GzipCompression({
      level: option.level,
      threshold: option.threshold,
    })
  }

  if (typeof option === 'object' && option !== null && !('compress' in option)) {
    const config = option as { level?: number; threshold?: number }

    return new GzipCompression({
      level: config.level,
      threshold: config.threshold,
    })
  }

  if (isCustomCompression(option)) {
    return option
  }

  return new GzipCompression()
}
