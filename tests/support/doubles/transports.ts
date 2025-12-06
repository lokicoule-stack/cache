/* eslint-disable @typescript-eslint/no-misused-promises */
/* eslint-disable @typescript-eslint/require-await */

import type { Transport } from '@/contracts/transport'
import type { TransportData, TransportMessageHandler } from '@/types'

export interface TransportBehaviorConfig {
  // Latency simulation
  latencyMs?: number

  // Failure simulation
  connectFailure?: boolean
  disconnectFailure?: boolean
  publishFailure?: boolean
  subscribeFailure?: boolean

  // Failure rate (0-1) for random failures
  failureRate?: number

  // Drop messages randomly
  messageDropRate?: number
}

export class FakeTransport implements Transport {
  readonly name = 'fake'
  connected = false

  private handlers = new Map<string, Set<TransportMessageHandler>>()
  private publishedMessages: Array<{ channel: string; data: TransportData }> = []

  async connect(): Promise<void> {
    this.connected = true
  }

  async disconnect(): Promise<void> {
    this.connected = false
    this.handlers.clear()
  }

  async publish(channel: string, data: TransportData): Promise<void> {
    if (!this.connected) {
      throw new Error('Transport not connected')
    }

    this.publishedMessages.push({ channel, data })

    const handlers = this.handlers.get(channel)
    if (handlers) {
      // Use setImmediate to simulate async nature
      for (const handler of handlers) {
        setImmediate(() => handler(data))
      }
    }
  }

  async subscribe(channel: string, handler: TransportMessageHandler): Promise<void> {
    if (!this.connected) {
      throw new Error('Transport not connected')
    }

    if (!this.handlers.has(channel)) {
      this.handlers.set(channel, new Set())
    }

    this.handlers.get(channel)!.add(handler)
  }

  async unsubscribe(channel: string): Promise<void> {
    this.handlers.delete(channel)
  }

  // Test inspection methods
  getPublishedMessages(): ReadonlyArray<{ channel: string; data: TransportData }> {
    return [...this.publishedMessages]
  }

  getSubscriberCount(channel: string): number {
    return this.handlers.get(channel)?.size ?? 0
  }

  clear(): void {
    this.publishedMessages = []
  }
}

/**
 * Configurable transport - for testing edge cases and failures
 * Use this when you need specific behaviors
 */
export class ConfigurableTransport implements Transport {
  readonly name = 'configurable'

  connected = false
  private publishedMessages: Array<{ channel: string; data: TransportData }> = []
  private subscribers = new Map<string, Set<TransportMessageHandler>>()
  private behavior: Required<TransportBehaviorConfig>

  constructor(behavior: TransportBehaviorConfig = {}) {
    this.behavior = {
      latencyMs: behavior.latencyMs ?? 0,
      connectFailure: behavior.connectFailure ?? false,
      disconnectFailure: behavior.disconnectFailure ?? false,
      publishFailure: behavior.publishFailure ?? false,
      subscribeFailure: behavior.subscribeFailure ?? false,
      failureRate: behavior.failureRate ?? 0,
      messageDropRate: behavior.messageDropRate ?? 0,
    }
  }

  // Fluent API for configuring behavior
  withLatency(ms: number): this {
    this.behavior.latencyMs = ms
    return this
  }

  withFailures(config: Partial<TransportBehaviorConfig>): this {
    Object.assign(this.behavior, config)
    return this
  }

  reset(): void {
    this.connected = false
    this.publishedMessages = []
    this.subscribers.clear()
    this.behavior = {
      latencyMs: 0,
      connectFailure: false,
      disconnectFailure: false,
      publishFailure: false,
      subscribeFailure: false,
      failureRate: 0,
      messageDropRate: 0,
    }
  }

  async connect(): Promise<void> {
    await this.simulateLatency()

    if (this.behavior.connectFailure || this.shouldFail()) {
      throw new Error('Failed to connect')
    }

    this.connected = true
  }

  async disconnect(): Promise<void> {
    await this.simulateLatency()

    if (this.behavior.disconnectFailure || this.shouldFail()) {
      throw new Error('Failed to disconnect')
    }

    this.connected = false
    this.subscribers.clear()
  }

  async publish(channel: string, data: TransportData): Promise<void> {
    await this.simulateLatency()

    if (this.behavior.publishFailure || this.shouldFail()) {
      throw new Error('Failed to publish')
    }

    // Simulate message drops
    if (Math.random() < this.behavior.messageDropRate) {
      return // Message dropped
    }

    this.publishedMessages.push({ channel, data })

    const handlers = this.subscribers.get(channel)
    if (handlers) {
      for (const handler of handlers) {
        setImmediate(() => handler(data))
      }
    }
  }

  async subscribe(channel: string, handler: TransportMessageHandler): Promise<void> {
    await this.simulateLatency()

    if (this.behavior.subscribeFailure || this.shouldFail()) {
      throw new Error('Failed to subscribe')
    }

    if (!this.subscribers.has(channel)) {
      this.subscribers.set(channel, new Set())
    }

    this.subscribers.get(channel)!.add(handler)
  }

  async unsubscribe(channel: string): Promise<void> {
    await this.simulateLatency()
    this.subscribers.delete(channel)
  }

  getPublishedMessages(): ReadonlyArray<{ channel: string; data: TransportData }> {
    return [...this.publishedMessages]
  }

  private async simulateLatency(): Promise<void> {
    if (this.behavior.latencyMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.behavior.latencyMs))
    }
  }

  private shouldFail(): boolean {
    return Math.random() < this.behavior.failureRate
  }
}

/**
 * Spy transport - wraps real transport and records calls
 * Use this when you want to verify interactions with a real transport
 */
export class SpyTransport implements Transport {
  readonly name = 'spy'

  // Call records
  readonly calls = {
    connect: [] as Array<{ timestamp: number }>,
    disconnect: [] as Array<{ timestamp: number }>,
    publish: [] as Array<{ channel: string; data: TransportData; timestamp: number }>,
    subscribe: [] as Array<{ channel: string; timestamp: number }>,
    unsubscribe: [] as Array<{ channel: string; timestamp: number }>,
  }

  constructor(private readonly wrapped: Transport) {}

  async connect(): Promise<void> {
    this.calls.connect.push({ timestamp: Date.now() })
    return this.wrapped.connect()
  }

  async disconnect(): Promise<void> {
    this.calls.disconnect.push({ timestamp: Date.now() })
    return this.wrapped.disconnect()
  }

  async publish(channel: string, data: TransportData): Promise<void> {
    this.calls.publish.push({ channel, data, timestamp: Date.now() })
    return this.wrapped.publish(channel, data)
  }

  async subscribe(channel: string, handler: TransportMessageHandler): Promise<void> {
    this.calls.subscribe.push({ channel, timestamp: Date.now() })
    return this.wrapped.subscribe(channel, handler)
  }

  async unsubscribe(channel: string): Promise<void> {
    this.calls.unsubscribe.push({ channel, timestamp: Date.now() })
    return this.wrapped.unsubscribe(channel)
  }

  // Inspection helpers
  wasConnected(): boolean {
    return this.calls.connect.length > 0
  }

  wasDisconnected(): boolean {
    return this.calls.disconnect.length > 0
  }

  wasPublishedTo(channel: string): boolean {
    return this.calls.publish.some((call) => call.channel === channel)
  }

  getPublishCount(channel?: string): number {
    if (!channel) return this.calls.publish.length
    return this.calls.publish.filter((call) => call.channel === channel).length
  }

  getSubscribeCount(channel?: string): number {
    if (!channel) return this.calls.subscribe.length
    return this.calls.subscribe.filter((call) => call.channel === channel).length
  }

  reset(): void {
    this.calls.connect = []
    this.calls.disconnect = []
    this.calls.publish = []
    this.calls.subscribe = []
    this.calls.unsubscribe = []
  }
}

/**
 * Factory functions for common test double scenarios
 */
export const createTransport = {
  /**
   * Default fake transport - use this for most tests
   */
  fake: (): FakeTransport => new FakeTransport(),

  /**
   * Transport that always fails
   */
  failing: (): ConfigurableTransport =>
    new ConfigurableTransport({
      connectFailure: true,
      publishFailure: true,
      subscribeFailure: true,
    }),

  /**
   * Slow transport for timeout testing
   */
  slow: (latencyMs: number = 1000): ConfigurableTransport =>
    new ConfigurableTransport({ latencyMs }),

  /**
   * Unreliable transport with random failures
   */
  unreliable: (failureRate: number = 0.3): ConfigurableTransport =>
    new ConfigurableTransport({ failureRate }),

  /**
   * Transport that drops messages
   */
  lossy: (dropRate: number = 0.2): ConfigurableTransport =>
    new ConfigurableTransport({ messageDropRate: dropRate }),

  /**
   * Spy on real transport
   */
  spy: (transport: Transport): SpyTransport => new SpyTransport(transport),
}
