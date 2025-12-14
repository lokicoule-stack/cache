import { TransportMiddleware } from '../base'

import type { CompressionConfig } from './compression-config'
import type { Compression } from '@/contracts/compression'
import type { Transport } from '@/contracts/transport'
import type { TransportData, TransportMessageHandler } from '@/types'

import { createCompression } from '@/infrastructure/compression'

export class CompressionMiddleware extends TransportMiddleware {
  readonly #compression: Compression

  constructor(transport: Transport, config?: CompressionConfig) {
    super(transport)
    this.#compression = createCompression(config?.compression)
  }

  override async publish(channel: string, data: TransportData): Promise<void> {
    const compressed = await this.#compression.compress(data)

    await this.transport.publish(channel, compressed)
  }

  override async subscribe(channel: string, handler: TransportMessageHandler): Promise<void> {
    return this.transport.subscribe(channel, async (compressedData: TransportData) => {
      const decompressed = await this.#compression.decompress(compressedData)

      await handler(decompressed)
    })
  }
}
