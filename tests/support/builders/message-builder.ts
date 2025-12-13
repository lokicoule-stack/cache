import type { TransportData } from '@/types'

export interface TestMessage {
  channel: string
  data: TransportData
}

/**
 * Fluent builder for creating test message data.
 *
 * @example
 * ```ts
 * const msg = MessageBuilder.create().withChannel('orders').withPayload({ id: 1 }).build()
 * const large = MessageBuilder.large(100) // 100KB of data
 * ```
 */
export class MessageBuilder {
  private channel = 'test-channel'
  private data: TransportData = new Uint8Array([1, 2, 3])

  static create(): MessageBuilder {
    return new MessageBuilder()
  }

  /** Create a message with N KB of data */
  static large(sizeKb: number): TestMessage {
    return new MessageBuilder().withSize(sizeKb * 1024).build()
  }

  /** Create an empty message */
  static empty(): TestMessage {
    return new MessageBuilder().withData(new Uint8Array([])).build()
  }

  /** Create a simple text message */
  static text(text: string, channel = 'test-channel'): TestMessage {
    return new MessageBuilder().withChannel(channel).withText(text).build()
  }

  /** Create a JSON payload message */
  static json<T>(payload: T, channel = 'test-channel'): TestMessage {
    return new MessageBuilder().withChannel(channel).withPayload(payload).build()
  }

  withChannel(channel: string): this {
    this.channel = channel
    return this
  }

  withData(data: TransportData): this {
    this.data = data
    return this
  }

  withBytes(...bytes: number[]): this {
    this.data = new Uint8Array(bytes)
    return this
  }

  withText(text: string): this {
    this.data = new TextEncoder().encode(text)
    return this
  }

  withPayload<T>(payload: T): this {
    this.data = new TextEncoder().encode(JSON.stringify(payload))
    return this
  }

  withSize(bytes: number): this {
    this.data = new Uint8Array(bytes).fill(65) // Fill with 'A'
    return this
  }

  withRandomData(bytes: number): this {
    this.data = new Uint8Array(bytes)
    crypto.getRandomValues(this.data)
    return this
  }

  /** Build the test message */
  build(): TestMessage {
    return {
      channel: this.channel,
      data: this.data,
    }
  }

  /** Build and return just the data */
  buildData(): TransportData {
    return this.data
  }
}

/**
 * Common test data fixtures
 */
export const TestData = {
  /** Small payload for basic tests */
  small: new Uint8Array([1, 2, 3]),

  /** Medium payload (1KB) */
  medium: new Uint8Array(1024).fill(65),

  /** Large payload (100KB) */
  large: new Uint8Array(100 * 1024).fill(65),

  /** Empty payload */
  empty: new Uint8Array([]),

  /** Compressible data (repeating pattern) */
  compressible: new Uint8Array(1000).fill(65),

  /** Incompressible data (random) */
  get incompressible(): Uint8Array {
    const data = new Uint8Array(1000)
    crypto.getRandomValues(data)
    return data
  },

  /** JSON payloads */
  json: {
    simple: new TextEncoder().encode(JSON.stringify({ key: 'value' })),
    nested: new TextEncoder().encode(
      JSON.stringify({
        id: 1,
        name: 'test',
        nested: { deep: { value: true } },
      }),
    ),
    array: new TextEncoder().encode(JSON.stringify([1, 2, 3, { a: 'b' }])),
  },

  /** Standard test channels */
  channels: {
    default: 'test-channel',
    orders: 'orders',
    events: 'events',
    notifications: 'notifications',
  },
} as const
