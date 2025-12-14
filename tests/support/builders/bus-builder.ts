import { MessageBus } from '@/core/bus/message-bus'
import type { BusOptions } from '@/core/bus/message-bus'
import type { Transport } from '@/contracts/transport'
import { FakeTransport } from '../doubles/fake-transport'

export class BusBuilder {
  #transport: Transport = new FakeTransport()
  #config: Partial<BusOptions> = { codec: 'json' }

  static create(): BusBuilder {
    return new BusBuilder()
  }

  static async connected(config?: Partial<BusOptions>): Promise<MessageBus> {
    const bus = new BusBuilder().with(config).build()
    await bus.connect()
    return bus
  }

  with(config?: Partial<BusOptions>): this {
    if (config) this.#config = { ...this.#config, ...config }
    return this
  }

  withTransport(transport: Transport): this {
    this.#transport = transport
    return this
  }

  withCodec(codec: BusOptions['codec']): this {
    this.#config.codec = codec
    return this
  }

  withMaxPayloadSize(maxPayloadSize: number): this {
    this.#config.maxPayloadSize = maxPayloadSize
    return this
  }

  withErrorHandler(handler: NonNullable<BusOptions['onHandlerError']>): this {
    this.#config.onHandlerError = handler
    return this
  }

  build(): MessageBus {
    return new MessageBus({
      transport: this.#transport,
      ...this.#config,
    })
  }

  async buildConnected(): Promise<MessageBus> {
    const bus = this.build()
    await bus.connect()
    return bus
  }

  buildWithTransport(): { bus: MessageBus; transport: FakeTransport } {
    return { bus: this.build(), transport: this.#transport as FakeTransport }
  }
}
