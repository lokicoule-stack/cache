import { RedisContainer, type StartedRedisContainer } from '@testcontainers/redis'

export class RedisInfrastructure {
  #container: StartedRedisContainer | null = null
  #image: string

  constructor(image = 'redis:7-alpine') {
    this.#image = image
  }

  async start(): Promise<string> {
    console.log(`Starting Redis container (${this.#image})...`)

    this.#container = await new RedisContainer(this.#image).start()

    const url = `redis://${this.#container.getHost()}:${this.#container.getPort()}`

    console.log(`Redis started at ${url}`)

    return url
  }

  async stop(): Promise<void> {
    if (!this.#container) return

    console.log('Stopping Redis container...')
    await this.#container.stop()
    this.#container = null
  }

  getConnectionUrl(): string {
    if (!this.#container) {
      throw new Error('Redis container not started')
    }

    return `redis://${this.#container.getHost()}:${this.#container.getPort()}`
  }

  async cleanup(): Promise<void> {
    await this.stop()
  }
}

export async function createRedisContainer(image?: string): Promise<RedisInfrastructure> {
  const redis = new RedisInfrastructure(image)
  await redis.start()
  return redis
}
