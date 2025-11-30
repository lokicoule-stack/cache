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
// eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
export type MessageType<T extends MessageMap> = keyof T & string
export type MessagePayload<
  T extends MessageMap,
  K extends MessageType<T>,
> = T[K]
export type MessageHandler<TPayload = unknown> = (
  payload: TPayload,
) => void | Promise<void>
export type Unsubscribe = () => void

export interface BusConfig {
  /** Transport layer (memory, redis, etc.) */
  transport: ITransport
  /** Channel name */
  channel: string
  /** Unique instance ID */
  instanceId: string
  /** Serializer (default: 'binary') */
  serializer?: 'binary' | 'json'
  /** Retry queue config (default: enabled) */
  retryQueue?: RetryQueueOptions | false
}

/**
 * Type-safe distributed message bus
 *
 * @example
 * ```ts
 * const bus = createBus<MyMessages>({
 *   transport: redis(),
 *   channel: 'app',
 *   instanceId: 'server-1'
 * })
 *
 * await bus.start()
 * bus.subscribe('user:login', (payload) => {
 *   console.log(payload.userId)
 * })
 * await bus.publish('user:login', { userId: 'alice' })
 * ```
 */
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

  /** Connect transport and start listening */
  async start(): Promise<void> {
    await this.#transport.connect()

    if (this.#retryQueue) {
      this.#retryQueue.start()
    }

    this.#transportUnsubscribe = await this.#transport.subscribe(
      this.#channel,
      (data: Uint8Array) => {
        try {
          const message =
            this.#serializer === 'binary'
              ? deserializeBinary(data)
              : deserializeJSON(data)
          this.#handleMessage(message)
        } catch (error) {
          console.error('[Bus] Failed to process message:', error)
        }
      },
    )
  }

  /** Disconnect transport and cleanup */
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

  /**
   * Subscribe to a message type
   *
   * @returns Unsubscribe function
   */
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

  /** Unsubscribe from a message type */
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

  /**
   * Publish a message (distributed to all instances)
   *
   * Automatically retries on failure if retry queue is enabled.
   */
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
      // Add to retry queue if enabled
      if (this.#retryQueue) {
        await this.#retryQueue.add(message, data, error as Error)
      } else {
        throw error
      }
    }
  }

  #handleMessage(message: Message): void {
    const handlers = this.#handlers.get(message.type)

    if (!handlers || handlers.size === 0) {
      return
    }

    handlers.forEach((handler: MessageHandler) => {
      try {
        void handler(message.payload)
      } catch (error) {
        console.error(`[Bus] Handler error for "${message.type}":`, error)
      }
    })
  }

  /** Get the underlying transport */
  getTransport(): ITransport {
    return this.#transport
  }
}

/**
 * Create a new message bus
 *
 * @example
 * ```ts
 * interface MyMessages {
 *   'user:login': { userId: string }
 *   'user:logout': { userId: string }
 * }
 *
 * const bus = createBus<MyMessages>({
 *   transport: redis({ host: 'localhost' }),
 *   channel: 'app',
 *   instanceId: 'server-1'
 * })
 * ```
 */
export function createBus<TMessages extends MessageMap>(
  config: BusConfig,
): Bus<TMessages> {
  return new Bus<TMessages>(config)
}
