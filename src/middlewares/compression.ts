/* import { promisify } from 'node:util'
import { gunzip, gzip } from 'node:zlib'
 */
import { TransportMiddleware } from './base'

import type { ITransport } from '../types'

/* const gzipAsync = promisify(gzip)
const gunzipAsync = promisify(gunzip)
 */
/**
 * Compression middleware
 */
export class CompressionMiddleware extends TransportMiddleware {
  constructor(transport: ITransport, private readonly _minSize: number = 1024) {
    super(transport)
  }

  /* override async publish(channel: string, data: TransportData): Promise<void> {
    if (data.length >= this.minSize) {
      const compressed = await gzipAsync(data)
      const withMarker = new Uint8Array(compressed.length + 1)
      withMarker[0] = 1 // Compressed marker
      withMarker.set(new Uint8Array(compressed), 1)
      await this.transport.publish(channel, withMarker)
    } else {
      const withMarker = new Uint8Array(data.length + 1)
      withMarker[0] = 0 // Not compressed marker
      withMarker.set(data, 1)
      await this.transport.publish(channel, withMarker)
    }
  }

  override async subscribe(channel: string, handler: TransportMessageHandler): Promise<void> {
    return this.transport.subscribe(channel, async (data) => {
      const isCompressed = data[0] === 1
      const actualData = data.slice(1)

      if (isCompressed) {
        const decompressed = await gunzipAsync(actualData)
        await handler(new Uint8Array(decompressed))
      } else {
        await handler(actualData)
      }
    })
  } */
}
