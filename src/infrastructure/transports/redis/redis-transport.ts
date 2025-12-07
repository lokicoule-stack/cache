import {
  createClient,
  createCluster,
  type RedisClientOptions,
  type RedisClusterOptions,
} from 'redis'

import { TransportError, TransportErrorCode, TransportOperation } from '../transport-errors'

import {
  type RedisTransportConfig,
  type RedisTransportExternalConfig,
  type RedisInstance,
  isClusterConfig,
  isExternalConfig,
} from './redis-transport-config'

import type { Transport } from '@/contracts/transport'
import type { TransportData, TransportMessageHandler } from '@/types'

const DEFAULT_RECONNECT_STRATEGY = (retries: number) => Math.min(retries * 100, 3000)

/**
 * Redis transport supporting standalone and cluster modes.
 *
 * @public
 */
export class RedisTransport implements Transport {
  readonly name = 'redis'

  #publisher?: RedisInstance
  #subscriber?: RedisInstance
  #config: RedisTransportConfig | RedisTransportExternalConfig
  #subscriptions = new Map<string, Set<TransportMessageHandler>>()
  #reconnectCallback?: () => void
  #isFirstConnection = true

  constructor(config: RedisTransportConfig | RedisTransportExternalConfig = {}) {
    this.#config = this.#normalizeConfig(config)
  }

  async connect(): Promise<void> {
    try {
      if (isExternalConfig(this.#config)) {
        await this.#connectWithExternalClient(this.#config.client)
      } else if (isClusterConfig(this.#config)) {
        await this.#connectCluster(this.#config)
      } else {
        await this.#connectStandalone(this.#config)
      }
    } catch (err) {
      throw this.#wrapError(TransportOperation.CONNECT, TransportErrorCode.CONNECTION_FAILED, err)
    }
  }

  async disconnect(): Promise<void> {
    try {
      await Promise.all([this.#publisher?.quit(), this.#subscriber?.quit()])
      this.#reset()
    } catch (err) {
      throw this.#wrapError(
        TransportOperation.DISCONNECT,
        TransportErrorCode.CONNECTION_FAILED,
        err,
      )
    }
  }

  async publish(channel: string, data: TransportData): Promise<void> {
    this.#ensureReady(this.#publisher, TransportOperation.PUBLISH)

    try {
      await this.#publisher.publish(channel, Buffer.from(data))
    } catch (err) {
      throw this.#wrapError(
        TransportOperation.PUBLISH,
        TransportErrorCode.PUBLISH_FAILED,
        err,
        channel,
      )
    }
  }

  async subscribe(channel: string, handler: TransportMessageHandler): Promise<void> {
    this.#ensureReady(this.#subscriber, TransportOperation.SUBSCRIBE)

    const isNewChannel = !this.#subscriptions.has(channel)

    if (isNewChannel) {
      this.#subscriptions.set(channel, new Set())

      try {
        await this.#subscriber.subscribe(channel, (msg) => {
          const data = new Uint8Array(Buffer.from(msg))
          const handlers = this.#subscriptions.get(channel)

          if (handlers) {
            for (const h of handlers) {
              Promise.resolve(h(data)).catch(() => {})
            }
          }
        })
      } catch (err) {
        this.#subscriptions.delete(channel)
        throw this.#wrapError(
          TransportOperation.SUBSCRIBE,
          TransportErrorCode.SUBSCRIBE_FAILED,
          err,
          channel,
        )
      }
    }

    const handlers = this.#subscriptions.get(channel)

    if (handlers) {
      handlers.add(handler)
    }
  }

  async unsubscribe(channel: string): Promise<void> {
    this.#ensureReady(this.#subscriber, TransportOperation.UNSUBSCRIBE)

    try {
      await this.#subscriber.unsubscribe(channel)
      this.#subscriptions.delete(channel)
    } catch (err) {
      throw this.#wrapError(
        TransportOperation.UNSUBSCRIBE,
        TransportErrorCode.UNSUBSCRIBE_FAILED,
        err,
        channel,
      )
    }
  }

  onReconnect(callback: () => void): void {
    this.#reconnectCallback = callback
  }

  async #connectWithExternalClient(client: RedisInstance): Promise<void> {
    this.#publisher = client
    this.#subscriber = client.duplicate()

    await Promise.all(
      [this.#publisher, this.#subscriber].map((c) => (c.isOpen ? Promise.resolve() : c.connect())),
    )
  }

  async #connectCluster(config: RedisClusterOptions): Promise<void> {
    this.#publisher = createCluster(config)
    this.#subscriber = this.#publisher.duplicate()

    this.#attachReconnectHandler()
    await Promise.all([this.#publisher.connect(), this.#subscriber.connect()])
  }

  async #connectStandalone(config: RedisClientOptions): Promise<void> {
    this.#publisher = createClient(config)
    this.#subscriber = this.#publisher.duplicate()

    this.#attachReconnectHandler()
    await Promise.all([this.#publisher.connect(), this.#subscriber.connect()])
  }

  #attachReconnectHandler(): void {
    if (!this.#publisher || !('on' in this.#publisher)) {
      return
    }

    this.#publisher.on('ready', () => {
      if (this.#isFirstConnection) {
        this.#isFirstConnection = false

        return
      }

      this.#reconnectCallback?.()
    })
  }

  #normalizeConfig(
    config: RedisTransportConfig | RedisTransportExternalConfig,
  ): RedisTransportConfig | RedisTransportExternalConfig {
    if (isExternalConfig(config) || isClusterConfig(config)) {
      return config
    }

    return {
      ...config,
      socket: {
        reconnectStrategy: DEFAULT_RECONNECT_STRATEGY,
        ...(config as RedisClientOptions).socket,
      },
    } as RedisClientOptions
  }

  #ensureReady(
    client: RedisInstance | undefined,
    operation: TransportOperation,
  ): asserts client is RedisInstance {
    if (!client) {
      throw new TransportError(
        `Transport not connected. Call connect() before ${operation}`,
        TransportErrorCode.NOT_READY,
        { context: { transport: this.name, operation, retryable: false } },
      )
    }

    const isReady = 'isReady' in client ? client.isReady : client.isOpen

    if (!isReady) {
      throw new TransportError(`Transport temporarily unavailable`, TransportErrorCode.NOT_READY, {
        context: { transport: this.name, operation, retryable: true },
      })
    }
  }

  #reset(): void {
    this.#publisher = undefined
    this.#subscriber = undefined
    this.#subscriptions.clear()
  }

  #wrapError(
    operation: TransportOperation,
    code: TransportErrorCode,
    err: unknown,
    channel?: string,
  ): TransportError {
    const error = err as Error
    const suffix = channel ? ` on channel '${channel}'` : ''

    return new TransportError(`Failed to ${operation}${suffix}: ${error.message}`, code, {
      context: {
        transport: this.name,
        operation,
        retryable: true,
        ...(channel && { channel }),
      },
      cause: error,
    })
  }
}

/**
 * Factory for creating Redis transport instances.
 *
 * @public
 */
export function redis(
  config?: RedisTransportConfig | RedisTransportExternalConfig,
): RedisTransport {
  return new RedisTransport(config)
}
