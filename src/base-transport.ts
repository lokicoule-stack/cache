import { BusError, TRANSPORT_STATES, type ITransport, type MessageHandler, type TransportState, type Unsubscribe } from './transport'

/**
 * Base transport using Template Method pattern
 *
 * Provides state management, error handling, and handler tracking.
 * Subclasses implement the actual transport logic.
 */
export abstract class BaseTransport implements ITransport {
  #state: TransportState = TRANSPORT_STATES.DISCONNECTED
  #handlers = new Map<string, Set<MessageHandler>>()

  constructor(public readonly name: string) { }

  get state(): TransportState {
    return this.#state
  }

  async connect(): Promise<void> {
    if (this.#state === TRANSPORT_STATES.CONNECTED) {
      return
    }

    this.#state = TRANSPORT_STATES.CONNECTING
    try {
      await this.doConnect()
      this.#state = TRANSPORT_STATES.CONNECTED
    } catch (error) {
      this.#state = TRANSPORT_STATES.ERROR
      throw new BusError(`Failed to connect ${this.name}`, error as Error)
    }
  }

  async disconnect(): Promise<void> {
    if (this.#state === TRANSPORT_STATES.DISCONNECTED) {
      return
    }

    try {
      await this.doDisconnect()
    } finally {
      this.#state = TRANSPORT_STATES.DISCONNECTED
      this.#handlers.clear()
    }
  }

  async publish(channel: string, data: Uint8Array): Promise<void> {
    if (this.#state !== TRANSPORT_STATES.CONNECTED) {
      throw new BusError(`Transport ${this.name} not connected`)
    }

    try {
      await this.doPublish(channel, data)
    } catch (error) {
      throw new BusError(`Failed to publish to ${channel}`, error as Error)
    }
  }

  async subscribe(channel: string, handler: MessageHandler): Promise<Unsubscribe> {
    if (this.#state !== TRANSPORT_STATES.CONNECTED) {
      throw new BusError(`Transport ${this.name} not connected`)
    }

    let handlers = this.#handlers.get(channel)

    if (!handlers) {
      handlers = new Set()
      this.#handlers.set(channel, handlers)

      await this.doSubscribe(channel, async (data) => {
        const channelHandlers = this.#handlers.get(channel)
        if (channelHandlers) {
          await Promise.all(
            Array.from(channelHandlers).map((h) => Promise.resolve(h(data))),
          )
        }
      })
    }

    handlers.add(handler)

    return async () => {
      handlers.delete(handler)
      if (handlers.size === 0) {
        this.#handlers.delete(channel)
        await this.doUnsubscribe(channel)
      }
    }
  }

  async unsubscribe(channel: string): Promise<void> {
    const handlers = this.#handlers.get(channel)
    if (handlers) {
      this.#handlers.delete(channel)
      await this.doUnsubscribe(channel)
    }
  }

  /** Protected getter for handlers (used by subclasses) */
  protected getHandlers(channel: string): Set<MessageHandler> | undefined {
    return this.#handlers.get(channel)
  }

  // Override these in your transport
  protected abstract doConnect(): Promise<void>
  protected abstract doDisconnect(): Promise<void>
  protected abstract doPublish(channel: string, data: Uint8Array): Promise<void>
  protected abstract doSubscribe(channel: string, handler: MessageHandler): Promise<void>
  protected abstract doUnsubscribe(channel: string): Promise<void>
}
