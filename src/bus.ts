import {
  createMessage,
  deserializeBinary,
  deserializeJSON,
  serializeBinary,
  serializeJSON,
  type Message,
} from './message'
import { RetryQueue, type RetryQueueOptions } from './retry-queue'

import type { ITransport } from './transport'

export type MessageMap = Record<string, unknown>
export type MessageType<T extends MessageMap> = keyof T & string
export type MessagePayload<
  T extends MessageMap,
  K extends MessageType<T>,
> = T[K]
export type MessageHandler<TPayload = unknown> = (
  payload: TPayload,
) => void | Promise<void>
export type Unsubscribe = () => void

/**
 * Bus configuration
 *
 * @example
 * ```ts
 * const bus = createBus<Messages>({
 *   transport: redis({ host: 'localhost' }),
 *   channel: 'app-events',
 *   instanceId: 'server-1',
 *   serializer: 'binary',
 *   retryQueue: {
 *     maxAttempts: 5,
 *     retryInterval: 2000
 *   }
 * })
 * ```
 */
export interface BusConfig {
  /** Transport layer (memory, redis, etc.) */
  transport: ITransport

  /** Channel name for pub/sub */
  channel: string

  /** Unique instance identifier */
  instanceId: string

  /**
   * Message serializer
   * @default 'binary'
   */
  serializer?: 'binary' | 'json'

  /**
   * Retry queue configuration
   * Set to `false` to disable retries
   * @default enabled with default options
   */
  retryQueue?: RetryQueueOptions | false
}

export class Bus<TMessages extends MessageMap> {
  #transport: ITransport
  #channel: string
  #instanceId: string
  #serializer: 'binary' | 'json'
  #retryQueue?: RetryQueue
  #handlers = new Map<string, Set<MessageHandler>>()
  #transportUnsubscribe?: () => Promise<void>

  constructor(config: BusConfig) {
    this.#transport = config.transport
    this.#channel = config.channel
    this.#instanceId = config.instanceId
    this.#serializer = config.serializer ?? 'binary'

    if (config.retryQueue !== false) {
      this.#retryQueue = new RetryQueue(
        typeof config.retryQueue === 'object' ? config.retryQueue : {},
      )

      this.#retryQueue.setRetryHandler(async (data: Uint8Array) => {
        await this.#transport.publish(this.#channel, data)
      })
    }
  }

  async start(): Promise<void> {
    await this.#transport.connect()

    if (this.#retryQueue) {
      this.#retryQueue.start()
    }

    this.#transportUnsubscribe = await this.#transport.subscribe(
      this.#channel,
      async (data: Uint8Array) => {
        const message =
          this.#serializer === 'binary'
            ? deserializeBinary(data)
            : deserializeJSON(data)
        await this.#handleMessage(message)
      },
    )
  }

  async stop(): Promise<void> {
    if (this.#retryQueue) {
      this.#retryQueue.stop()
    }

    if (this.#transportUnsubscribe) {
      await this.#transportUnsubscribe()
    }
    await this.#transport.disconnect()
    this.#handlers.clear()
  }

  subscribe<K extends MessageType<TMessages>>(
    messageType: K,
    handler: MessageHandler<MessagePayload<TMessages, K>>,
  ): Unsubscribe {
    let handlers = this.#handlers.get(messageType)

    if (!handlers) {
      handlers = new Set()
      this.#handlers.set(messageType, handlers)
    }

    handlers.add(handler as MessageHandler)

    return () => {
      handlers.delete(handler as MessageHandler)
      if (handlers.size === 0) {
        this.#handlers.delete(messageType)
      }
    }
  }

  unsubscribe<K extends MessageType<TMessages>>(
    messageType: K,
    handler?: MessageHandler<MessagePayload<TMessages, K>>,
  ): void {
    if (handler) {
      const handlers = this.#handlers.get(messageType)
      if (handlers) {
        handlers.delete(handler as MessageHandler)
        if (handlers.size === 0) {
          this.#handlers.delete(messageType)
        }
      }
    } else {
      this.#handlers.delete(messageType)
    }
  }

  async publish<K extends MessageType<TMessages>>(
    messageType: K,
    payload: MessagePayload<TMessages, K>,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    const message = createMessage(
      messageType,
      payload,
      this.#instanceId,
      metadata,
    )
    const data =
      this.#serializer === 'binary'
        ? serializeBinary(message)
        : serializeJSON(message)

    try {
      await this.#transport.publish(this.#channel, data)
    } catch (error) {
      if (this.#retryQueue) {
        await this.#retryQueue.add(message, data, error as Error)
      } else {
        throw error
      }
    }
  }

  async #handleMessage(message: Message): Promise<void> {
    const handlers = this.#handlers.get(message.type)

    if (!handlers || handlers.size === 0) {
      return
    }

    await Promise.all(
      Array.from(handlers).map((handler: MessageHandler) =>
        Promise.resolve(handler(message.payload)),
      ),
    )
  }

  getTransport(): ITransport {
    return this.#transport
  }
}

export function createBus<TMessages extends MessageMap>(
  config: BusConfig,
): Bus<TMessages> {
  return new Bus<TMessages>(config)
}
