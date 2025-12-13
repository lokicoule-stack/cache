// Compression Implementation
export { GzipCompression } from './gzip-compression'

// Compression Factory
export { createCompression } from './compression-factory'

// Compression Errors
export {
  CompressionError,
  CompressionErrorCode,
  CompressionConfigError,
} from './compression-errors'
export type { CompressionErrorContext } from './compression-errors'
