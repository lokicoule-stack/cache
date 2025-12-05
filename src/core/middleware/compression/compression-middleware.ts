import { TransportMiddleware } from '../base'

import { isGzipConfig, type CompressionConfig, type CompressionOption } from './compression-config'

import type { Compression } from '@/contracts/compression'
import type { Transport, TransportData, TransportMessageHandler } from '@/types'

import { GzipCompression } from '@/infrastructure/compression/gzip-compression'

export class CompressionMiddleware extends TransportMiddleware {
  readonly #compression: Compression

  constructor(transport: Transport, config: CompressionConfig) {
    super(transport)
    this.#compression = this.#resolveCompression(config.compression)
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

  /**
   * Resolve compression option to concrete implementation
   *
   * @param option - Compression option (magic string, config, or implementation)
   * @returns Resolved compression implementation
   */
  #resolveCompression(option: CompressionOption): Compression {
    // Handle magic string
    if (typeof option === 'string') {
      switch (option) {
        case 'gzip':
          return new GzipCompression()
      }
    }

    // Handle Gzip config object (discriminated union)
    if (isGzipConfig(option)) {
      return new GzipCompression({
        level: option.level,
        threshold: option.threshold,
      })
    }

    // Direct Compression interface injection
    return option
  }
}
