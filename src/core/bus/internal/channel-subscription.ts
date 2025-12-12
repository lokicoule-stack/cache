import type { MessageHandler, Serializable } from '@/types'

/**
 * @internal
 */
export class ChannelSubscription {
  readonly #handlers = new Set<MessageHandler>()
  #isActive = false

  get isActive(): boolean {
    return this.#isActive
  }

  get handlerCount(): number {
    return this.#handlers.size
  }

  addHandler(handler: MessageHandler): void {
    this.#handlers.add(handler)
  }

  removeHandler(handler: MessageHandler): boolean {
    return this.#handlers.delete(handler)
  }

  markActive(): void {
    this.#isActive = true
  }

  async notifyHandlers<T extends Serializable>(data: T): Promise<PromiseSettledResult<void>[]> {
    const handlerPromises = Array.from(this.#handlers).map((handler) =>
      Promise.resolve().then(() => handler(data)),
    )

    return Promise.allSettled(handlerPromises)
  }

  clear(): void {
    this.#handlers.clear()
  }
}
