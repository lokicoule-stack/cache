import { resolveCodec, type CodecOption, type ICodec } from './codec'
import { type ITransport, type MessageHandler, type Serializable } from './types'

export interface BusOptions {
  transport: ITransport
  codec: CodecOption
  onHandlerError?: (channel: string, error: Error) => void
}

/**
 * Type-safe message bus
 */
export class Bus {
  #transport: ITransport
  #codec: ICodec
  #handlers = new Map<string, Set<MessageHandler>>()
  #onHandlerError?: (channel: string, error: Error) => void

  constructor(options: BusOptions) {
    this.#transport = options.transport
    this.#codec = resolveCodec(options.codec)
    this.#onHandlerError = options.onHandlerError
  }

  async publish<T extends Serializable>(channel: string, data: T): Promise<void> {
    const bytes = this.#codec.encode(data)
    await this.#transport.publish(channel, bytes)
  }

  async subscribe<T extends Serializable>(
    channel: string,
    handler: MessageHandler<T>,
  ): Promise<void> {
    if (!this.#handlers.has(channel)) {
      this.#handlers.set(channel, new Set())

      await this.#transport.subscribe(channel, (bytes) => {
        const data = this.#codec.decode<T>(bytes)
        const handlers = this.#handlers.get(channel)
        if (handlers) {
          for (const h of handlers) {
            Promise.resolve(h(data)).catch((error: Error) => {
              if (this.#onHandlerError) {
                this.#onHandlerError(channel, error)
              }
            })
          }
        }
      })
    }

    this.#handlers.get(channel)?.add(handler as MessageHandler)
  }

  async unsubscribe(channel: string, handler?: MessageHandler): Promise<void> {
    const handlers = this.#handlers.get(channel)
    if (!handlers) {return}

    if (handler) {
      handlers.delete(handler)
      if (handlers.size === 0) {
        await this.#transport.unsubscribe(channel)
        this.#handlers.delete(channel)
      }
    } else {
      await this.#transport.unsubscribe(channel)
      this.#handlers.delete(channel)
    }
  }

  async connect(): Promise<void> {
    await this.#transport.connect()
  }

  async disconnect(): Promise<void> {
    for (const channel of this.#handlers.keys()) {
      await this.unsubscribe(channel)
    }
    await this.#transport.disconnect()
  }

  get channels(): string[] {
    return Array.from(this.#handlers.keys())
  }
}