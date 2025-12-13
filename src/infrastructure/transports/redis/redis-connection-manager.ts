import {
  createClient,
  createCluster,
  type RedisClientOptions,
  type RedisClusterOptions,
} from 'redis'

import {
  type RedisTransportConfig,
  type RedisTransportExternalConfig,
  type RedisInstance,
  isClusterConfig,
  isExternalConfig,
} from './redis-transport-config'

const DEFAULT_RECONNECT_STRATEGY = (retries: number) => Math.min(retries * 100, 3000)

interface ConnectionStrategy {
  supportsReconnectHandler: boolean
  connect(): Promise<{ publisher: RedisInstance; subscriber: RedisInstance }>
}

class ExternalConnectionStrategy implements ConnectionStrategy {
  readonly supportsReconnectHandler = false

  constructor(private readonly client: RedisInstance) {}

  async connect(): Promise<{ publisher: RedisInstance; subscriber: RedisInstance }> {
    const publisher = this.client.duplicate()
    const subscriber = this.client.duplicate()

    await Promise.all(
      [publisher, subscriber].map((client) =>
        client.isOpen ? Promise.resolve() : client.connect(),
      ),
    )

    return { publisher, subscriber }
  }
}

class ClusterConnectionStrategy implements ConnectionStrategy {
  readonly supportsReconnectHandler = true

  constructor(private readonly config: RedisClusterOptions) {}

  async connect(): Promise<{ publisher: RedisInstance; subscriber: RedisInstance }> {
    const publisher = createCluster(this.config)
    const subscriber = publisher.duplicate()

    await Promise.all([publisher.connect(), subscriber.connect()])

    return { publisher, subscriber }
  }
}

class StandaloneConnectionStrategy implements ConnectionStrategy {
  readonly supportsReconnectHandler = true

  constructor(private readonly config: RedisClientOptions) {}

  async connect(): Promise<{ publisher: RedisInstance; subscriber: RedisInstance }> {
    const publisher = createClient(this.config)
    const subscriber = publisher.duplicate()

    await Promise.all([publisher.connect(), subscriber.connect()])

    return { publisher, subscriber }
  }
}

export class RedisConnectionManager {
  #publisher?: RedisInstance
  #subscriber?: RedisInstance
  #strategy: ConnectionStrategy
  #reconnectCallback?: () => void
  #isFirstConnection = true

  constructor(config: RedisTransportConfig | RedisTransportExternalConfig) {
    this.#strategy = this.#createStrategy(config)
  }

  get publisher(): RedisInstance | undefined {
    return this.#publisher
  }

  get subscriber(): RedisInstance | undefined {
    return this.#subscriber
  }

  async connect(): Promise<void> {
    const { publisher, subscriber } = await this.#strategy.connect()

    this.#publisher = publisher
    this.#subscriber = subscriber

    if (this.#strategy.supportsReconnectHandler) {
      this.#attachReconnectHandler(publisher)
    }
  }

  async disconnect(): Promise<void> {
    await Promise.all([this.#publisher?.quit(), this.#subscriber?.quit()])
    this.#publisher = undefined
    this.#subscriber = undefined
  }

  onReconnect(callback: () => void): void {
    this.#reconnectCallback = callback
  }

  isReady(client?: RedisInstance): boolean {
    if (!client) {
      return false
    }

    if ('isReady' in client && typeof client.isReady === 'boolean') {
      return client.isReady
    }

    return 'isOpen' in client && client.isOpen
  }

  #createStrategy(config: RedisTransportConfig | RedisTransportExternalConfig): ConnectionStrategy {
    if (isExternalConfig(config)) {
      return new ExternalConnectionStrategy(config.client)
    }

    if (isClusterConfig(config)) {
      return new ClusterConnectionStrategy(config)
    }

    const normalizedConfig = this.#normalizeStandaloneConfig(config)

    return new StandaloneConnectionStrategy(normalizedConfig)
  }

  #normalizeStandaloneConfig(config: RedisClientOptions): RedisClientOptions {
    return {
      ...config,
      socket: {
        reconnectStrategy: DEFAULT_RECONNECT_STRATEGY,
        ...config.socket,
      },
    }
  }

  #attachReconnectHandler(client: RedisInstance): void {
    if (!('on' in client)) {
      return
    }

    client.on('ready', () => {
      if (this.#isFirstConnection) {
        this.#isFirstConnection = false

        return
      }

      this.#reconnectCallback?.()
    })
  }
}
