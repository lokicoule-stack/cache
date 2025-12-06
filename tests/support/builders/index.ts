/**
 * Test builders - FAANG grade builder pattern
 *
 * Principles:
 * - Fluent API: chainable methods
 * - Immutable: each method returns new instance
 * - Sensible defaults: works without configuration
 * - Type-safe: leverages TypeScript fully
 */

import type { Serializable } from '@/types'
import type { BusOptions } from '@/core/bus/message-bus'
import type { CodecOption } from '@/contracts/codec'
import type { Transport } from '@/contracts/transport'
import { MemoryTransport } from '@/infrastructure/transports/memory/memory-transport'

/**
 * Message builder for test messages
 */
export class MessageBuilder<T extends Serializable = Serializable> {
  private constructor(
    private readonly config: {
      channel: string
      payload: T
      metadata?: Record<string, unknown>
    },
  ) {}

  static create<T extends Serializable = Serializable>(): MessageBuilder<T> {
    return new MessageBuilder<T>({
      channel: 'test',
      payload: {} as T,
    })
  }

  channel(channel: string): MessageBuilder<T> {
    return new MessageBuilder({ ...this.config, channel })
  }

  payload(payload: T): MessageBuilder<T> {
    return new MessageBuilder({ ...this.config, payload })
  }

  metadata(metadata: Record<string, unknown>): MessageBuilder<T> {
    return new MessageBuilder({ ...this.config, metadata })
  }

  build(): { channel: string; payload: T; metadata?: Record<string, unknown> } {
    return { ...this.config }
  }

  // Convenience: build and return just payload
  buildPayload(): T {
    return this.config.payload
  }

  // Convenience: build and return just channel
  buildChannel(): string {
    return this.config.channel
  }
}

/**
 * Bus options builder for creating test buses
 */
export class BusOptionsBuilder {
  private constructor(private readonly config: Partial<BusOptions>) {}

  static create(): BusOptionsBuilder {
    return new BusOptionsBuilder({})
  }

  transport(transport: Transport): BusOptionsBuilder {
    return new BusOptionsBuilder({ ...this.config, transport })
  }

  memoryTransport(): BusOptionsBuilder {
    return this.transport(new MemoryTransport())
  }

  codec(codec: CodecOption): BusOptionsBuilder {
    return new BusOptionsBuilder({ ...this.config, codec })
  }

  onError(handler: (channel: string, error: Error) => void): BusOptionsBuilder {
    return new BusOptionsBuilder({ ...this.config, onHandlerError: handler })
  }

  middleware(mw: BusOptions['middleware']): BusOptionsBuilder {
    return new BusOptionsBuilder({ ...this.config, middleware: mw })
  }

  build(): Partial<BusOptions> {
    return { ...this.config }
  }

  buildComplete(): BusOptions {
    return {
      transport: this.config.transport || new MemoryTransport(),
      codec: this.config.codec || 'json',
      ...this.config,
    } as BusOptions
  }
}

/**
 * Payload generator for dynamic test data
 */
export class PayloadGenerator {
  /**
   * Generate nested object of specified depth
   */
  static nested(depth: number, value: Serializable = 'leaf'): Serializable {
    if (depth === 0) {
      return { value }
    }

    return {
      level: depth,
      nested: this.nested(depth - 1, value),
      array: Array.from({ length: 3 }, (_, i) => ({
        id: i,
        depth,
      })),
    }
  }

  /**
   * Generate payload of approximate byte size
   */
  static sized(bytes: number): { data: string; size: number } {
    const data = 'x'.repeat(bytes)
    return { data, size: bytes }
  }

  /**
   * Generate array of items using factory
   */
  static array<T>(count: number, factory: (index: number) => T): T[] {
    return Array.from({ length: count }, (_, i) => factory(i))
  }

  /**
   * Generate sequence of events
   */
  static eventSequence(
    count: number,
    type: string = 'test.event',
  ): Array<{
    type: string
    sequence: number
    timestamp: number
    data: unknown
  }> {
    const base = Date.now()
    return this.array(count, (i) => ({
      type,
      sequence: i,
      timestamp: base + i * 1000,
      data: { index: i },
    }))
  }

  /**
   * Generate user object with variations
   */
  static user(
    id: number = 1,
    overrides?: Partial<{
      name: string
      email: string
      roles: string[]
      active: boolean
    }>,
  ): {
    id: number
    name: string
    email: string
    roles: string[]
    active: boolean
  } {
    return {
      id,
      name: `User ${id}`,
      email: `user${id}@example.com`,
      roles: ['user'],
      active: true,
      ...overrides,
    }
  }

  /**
   * Generate random-ish data (but deterministic with seed)
   */
  static seeded(seed: number): {
    id: number
    value: number
    text: string
  } {
    // Simple seeded random
    const random = (seed * 9301 + 49297) % 233280
    const normalized = random / 233280

    return {
      id: seed,
      value: Math.floor(normalized * 1000),
      text: `generated-${seed}-${Math.floor(normalized * 100)}`,
    }
  }

  /**
   * Generate special characters for edge case testing
   */
  static specialChars(): {
    empty: string
    whitespace: string
    unicode: string
    emoji: string
    control: string
    quotes: string
  } {
    return {
      empty: '',
      whitespace: ' \n\t\r',
      unicode: '你好世界',
      emoji: '🚀💻🎉',
      control: '\x00\x01\x02',
      quotes: '"\'`\\',
    }
  }

  /**
   * Generate edge case values for serialization
   */
  static edgeCases(): Serializable[] {
    return [
      null,
      true,
      false,
      0,
      -0,
      1,
      -1,
      Number.MAX_SAFE_INTEGER,
      Number.MIN_SAFE_INTEGER,
      '',
      'test',
      [],
      {},
      [1, 2, 3],
      { a: 1, b: 2 },
      { nested: { deep: { value: true } } },
    ]
  }
}

/**
 * Scenario builder for complex test scenarios
 */
export class ScenarioBuilder<T = unknown> {
  private constructor(
    private readonly steps: Array<{
      name: string
      action: () => Promise<T>
      verify?: (result: T) => void | Promise<void>
    }>,
  ) {}

  static create<T = unknown>(): ScenarioBuilder<T> {
    return new ScenarioBuilder<T>([])
  }

  step(
    name: string,
    action: () => Promise<T>,
    verify?: (result: T) => void | Promise<void>,
  ): ScenarioBuilder<T> {
    return new ScenarioBuilder([...this.steps, { name, action, verify }])
  }

  async execute(): Promise<T[]> {
    const results: T[] = []

    for (const step of this.steps) {
      const result = await step.action()
      results.push(result)

      if (step.verify) {
        await step.verify(result)
      }
    }

    return results
  }

  async executeWithTiming(): Promise<
    Array<{
      name: string
      result: T
      durationMs: number
    }>
  > {
    const results: Array<{
      name: string
      result: T
      durationMs: number
    }> = []

    for (const step of this.steps) {
      const start = Date.now()
      const result = await step.action()
      const durationMs = Date.now() - start

      results.push({ name: step.name, result, durationMs })

      if (step.verify) {
        await step.verify(result)
      }
    }

    return results
  }
}

export const message = <T extends Serializable = Serializable>() => MessageBuilder.create<T>()
export const busOptions = () => BusOptionsBuilder.create()
export const generate = PayloadGenerator
export const scenario = <T = unknown>() => ScenarioBuilder.create<T>()
