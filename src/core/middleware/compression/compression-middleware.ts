import { TransportMiddleware } from '../base'

import { isGzipConfig, type CompressionConfig, type CompressionOption } from './compression-config'

import type { Compression } from '@/contracts/compression'
import type { Transport } from '@/contracts/transport'
import type { TransportData, TransportMessageHandler } from '@/types'

import { GzipCompression } from '@/infrastructure/compression/gzip-compression'

/**
 * @internal
 */
export class CompressionMiddleware extends TransportMiddleware {
  readonly #compression: Compression

  constructor(transport: Transport, config?: CompressionConfig) {
    super(transport)
    this.#compression = this.#resolveCompression(config?.compression)
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

  #resolveCompression(option?: CompressionOption): Compression {
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

    return option
  }
}
