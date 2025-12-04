import { TransportMiddleware } from '../base'

import type { CompressionConfig } from './compression.config'
import type { ICompression } from '@/core/compression'
import type { ITransport } from '@/core/transport'
import type { TransportData, TransportMessageHandler } from '@/core/types'

/**
 * Compression middleware with pluggable compression implementations
 *
 * Provides a decorator for ITransport that applies compression/decompression
 * transformations to all published and subscribed messages.
 *
 * The middleware delegates to an ICompression implementation,
 * allowing flexible choice of compression algorithms.
 *
 * @example
 * ```typescript
 * import { GzipCompression } from '../../../infrastructure/compression'
 *
 * // Gzip compression
 * const middleware = new CompressionMiddleware(transport, {
 *   compression: new GzipCompression({ level: 6, threshold: 1024 })
 * })
 * ```
 */
export class CompressionMiddleware extends TransportMiddleware {
  readonly #compression: ICompression

  constructor(transport: ITransport, config: CompressionConfig) {
    super(transport)
    this.#compression = config.compression
  }

  override async publish(channel: string, data: TransportData): Promise<void> {
    const compressed = await this.#compression.compress(data)
    await this.transport.publish(channel, compressed)
  }

  override async subscribe(channel: string, handler: TransportMessageHandler): Promise<void> {
    return this.transport.subscribe(channel, async (compressedData: TransportData) => {
      const decompressed = await this.#compression.decompress(compressedData)
      handler(decompressed)
    })
  }
}
