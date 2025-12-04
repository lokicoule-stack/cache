import { beforeEach, vi } from 'vitest'

import type { Transport } from '@/core/transport'
import type { TransportData, TransportMessageHandler } from '@/core/types'

/**
 * Mock transport for testing
 */
export class MockTransport implements Transport {
  readonly name = 'mock'

  connected = false
  publishedMessages: Array<{ channel: string; data: TransportData }> = []
  subscribers = new Map<string, Set<TransportMessageHandler>>()
  connectDelay = 0
  disconnectDelay = 0
  publishDelay = 0
  subscribeDelay = 0
  shouldFailConnect = false
  shouldFailDisconnect = false
  shouldFailPublish = false
  shouldFailSubscribe = false

  async connect(): Promise<void> {
    if (this.shouldFailConnect) {
      throw new Error('Mock connect failed')
    }
    await this.delay(this.connectDelay)
    this.connected = true
  }

  async disconnect(): Promise<void> {
    if (this.shouldFailDisconnect) {
      throw new Error('Mock disconnect failed')
    }
    await this.delay(this.disconnectDelay)
    this.connected = false
    this.subscribers.clear()
  }

  async publish(channel: string, data: TransportData): Promise<void> {
    if (this.shouldFailPublish) {
      throw new Error('Mock publish failed')
    }
    await this.delay(this.publishDelay)
    this.publishedMessages.push({ channel, data })

    const handlers = this.subscribers.get(channel)
    if (handlers) {
      for (const handler of handlers) {
        setImmediate(() => handler(data))
      }
    }
  }

  async subscribe(channel: string, handler: TransportMessageHandler): Promise<void> {
    if (this.shouldFailSubscribe) {
      throw new Error('Mock subscribe failed')
    }
    await this.delay(this.subscribeDelay)
    if (!this.subscribers.has(channel)) {
      this.subscribers.set(channel, new Set())
    }
    this.subscribers.get(channel)?.add(handler)
  }

  async unsubscribe(channel: string): Promise<void> {
    this.subscribers.delete(channel)
  }

  reset(): void {
    this.connected = false
    this.publishedMessages = []
    this.subscribers.clear()
    this.connectDelay = 0
    this.disconnectDelay = 0
    this.publishDelay = 0
    this.subscribeDelay = 0
    this.shouldFailConnect = false
    this.shouldFailDisconnect = false
    this.shouldFailPublish = false
    this.shouldFailSubscribe = false
  }

  private delay(ms: number): Promise<void> {
    return ms > 0 ? new Promise((resolve) => setTimeout(resolve, ms)) : Promise.resolve()
  }
}

/**
 * Flaky transport that randomly fails operations
 */
export class FlakyTransport implements Transport {
  readonly name = 'flaky'

  private transport: Transport
  private failureRate: number

  constructor(transport: Transport, failureRate = 0.3) {
    this.transport = transport
    this.failureRate = failureRate
  }

  private shouldFail(): boolean {
    return Math.random() < this.failureRate
  }

  async connect(): Promise<void> {
    if (this.shouldFail()) {
      throw new Error('Flaky connect failed')
    }
    return this.transport.connect()
  }

  async disconnect(): Promise<void> {
    if (this.shouldFail()) {
      throw new Error('Flaky disconnect failed')
    }
    return this.transport.disconnect()
  }

  async publish(channel: string, data: TransportData): Promise<void> {
    if (this.shouldFail()) {
      throw new Error('Flaky publish failed')
    }
    return this.transport.publish(channel, data)
  }

  async subscribe(channel: string, handler: TransportMessageHandler): Promise<void> {
    if (this.shouldFail()) {
      throw new Error('Flaky subscribe failed')
    }
    return this.transport.subscribe(channel, handler)
  }

  async unsubscribe(channel: string): Promise<void> {
    if (this.shouldFail()) {
      throw new Error('Flaky unsubscribe failed')
    }
    return this.transport.unsubscribe(channel)
  }
}

/**
 * Slow transport for performance testing
 */
export class SlowTransport implements Transport {
  readonly name = 'slow'

  private transport: Transport
  private latency: number

  constructor(transport: Transport, latency = 100) {
    this.transport = transport
    this.latency = latency
  }

  private async delay(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, this.latency))
  }

  async connect(): Promise<void> {
    await this.delay()
    return this.transport.connect()
  }

  async disconnect(): Promise<void> {
    await this.delay()
    return this.transport.disconnect()
  }

  async publish(channel: string, data: TransportData): Promise<void> {
    await this.delay()
    return this.transport.publish(channel, data)
  }

  async subscribe(channel: string, handler: TransportMessageHandler): Promise<void> {
    await this.delay()
    return this.transport.subscribe(channel, handler)
  }

  async unsubscribe(channel: string): Promise<void> {
    await this.delay()
    return this.transport.unsubscribe(channel)
  }
}

/**
 * Wait for condition with timeout
 */
export async function waitFor(
  condition: () => boolean,
  timeout = 1000,
  interval = 10,
): Promise<void> {
  const start = Date.now()
  while (!condition()) {
    if (Date.now() - start > timeout) {
      throw new Error('Timeout waiting for condition')
    }
    await new Promise((resolve) => setTimeout(resolve, interval))
  }
}

/**
 * Wait for specific number of milliseconds
 */
export async function delay(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Create a deferred promise
 */
export function createDeferred<T>(): {
  promise: Promise<T>
  resolve: (value: T) => void
  reject: (error: Error) => void
} {
  let resolve!: (value: T) => void
  let reject!: (error: Error) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

/**
 * Setup for resetting all mocks before each test
 */
export function setupTestEnvironment(): void {
  beforeEach(() => {
    vi.clearAllMocks()
  })
}
