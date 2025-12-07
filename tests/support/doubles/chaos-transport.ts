import type { Transport } from '@/contracts/transport'
import type { TransportData, TransportMessageHandler } from '@/types'

export class ChaosTransport implements Transport {
  readonly name = 'chaos'

  #inner: Transport
  #shouldFail = false
  #failCount = 0
  #failUntil = 0
  #onReconnectCallback?: () => void

  constructor(transport: Transport) {
    this.#inner = transport
  }

  alwaysFail(): this {
    this.#shouldFail = true
    return this
  }

  /** Trigger reconnect callback */
  recover(): this {
    this.#shouldFail = false
    this.#failUntil = 0
    this.#onReconnectCallback?.()

    return this
  }

  neverFail(): this {
    this.#shouldFail = false
    this.#failUntil = 0

    return this
  }

  failNext(count: number): this {
    this.#failCount = 0
    this.#failUntil = count
    return this
  }

  get failures(): number {
    return this.#failCount
  }

  async connect(): Promise<void> {
    this.#maybeThrow()
    return this.#inner.connect()
  }

  async disconnect(): Promise<void> {
    return this.#inner.disconnect()
  }

  async publish(channel: string, data: TransportData): Promise<void> {
    this.#maybeThrow()
    return this.#inner.publish(channel, data)
  }

  async subscribe(channel: string, handler: TransportMessageHandler): Promise<void> {
    this.#maybeThrow()
    return this.#inner.subscribe(channel, handler)
  }

  async unsubscribe(channel: string): Promise<void> {
    return this.#inner.unsubscribe(channel)
  }

  onReconnect(callback: () => void): void {
    this.#onReconnectCallback = callback
  }

  #maybeThrow(): void {
    if (this.#shouldFail) {
      this.#failCount++
      throw new Error('Chaos failure')
    }

    if (this.#failUntil > 0 && this.#failCount < this.#failUntil) {
      this.#failCount++
      throw new Error('Chaos failure')
    }
  }
}
