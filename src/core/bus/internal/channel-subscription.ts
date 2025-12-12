import type { MessageHandler, Serializable } from '@/types'

/**
 * @internal
 */
export class ChannelSubscription {
  readonly #handlers = new Set<MessageHandler>()

  get handlerCount(): number {
    return this.#handlers.size
  }

  addHandler(handler: MessageHandler): void {
    this.#handlers.add(handler)
  }

  removeHandler(handler: MessageHandler): boolean {
    return this.#handlers.delete(handler)
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
