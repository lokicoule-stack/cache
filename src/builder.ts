import { CompressionMiddleware } from './middlewares/compression'
import { EncryptionMiddleware, type EncryptionOptions } from './middlewares/encryption'
import { RetryMiddleware } from './middlewares/retry'

import type { QueueProcessor } from './queue'
import type { ITransport } from './types'

export class TransportBuilder {
  #transport: ITransport

  constructor(transport: ITransport) {
    this.#transport = transport
  }

  withRetry(queueProcessor: QueueProcessor): this {
    this.#transport = new RetryMiddleware(this.#transport, queueProcessor)
    return this
  }

  withCompression(minSize?: number): this {
    this.#transport = new CompressionMiddleware(this.#transport, minSize)
    return this
  }

  withEncryption(options: EncryptionOptions): this {
    this.#transport = new EncryptionMiddleware(this.#transport, options)
    return this
  }

  build(): ITransport {
    return this.#transport
  }
}
