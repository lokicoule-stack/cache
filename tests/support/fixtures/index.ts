/**
 * Test fixtures - Immutable, reusable test data
 *
 * FAANG principle: Fixtures are READONLY, deterministic data
 * For dynamic data generation, use builders instead
 */

import { Serializable } from '@/types'

/**
 * Standard test messages
 */
export const messages = {
  simple: {
    channel: 'test',
    payload: { message: 'hello' },
  },

  withMetadata: {
    channel: 'events',
    payload: {
      type: 'user.created',
      data: { id: 1, name: 'Alice' },
      metadata: { timestamp: 1234567890, version: '1.0' },
    },
  },

  empty: {
    channel: 'test',
    payload: {},
  },

  nullPayload: {
    channel: 'test',
    payload: null,
  },
} as const

/**
 * User test data
 */
export const users = {
  alice: {
    id: 1,
    name: 'Alice',
    email: 'alice@example.com',
    roles: ['user', 'admin'],
  } as Serializable,

  bob: {
    id: 2,
    name: 'Bob',
    email: 'bob@example.com',
    roles: ['user'],
  } as Serializable,

  guest: {
    id: 3,
    name: 'Guest',
    email: 'guest@example.com',
    roles: [],
  } as Serializable,
} as const

/**
 * Event payloads for event-driven testing
 */
export const events = {
  userCreated: {
    type: 'user.created',
    userId: 1,
    timestamp: Date.now(),
  },

  orderPlaced: {
    type: 'order.placed',
    orderId: 'ORD-001',
    items: [
      { sku: 'ITEM-1', quantity: 2 },
      { sku: 'ITEM-2', quantity: 1 },
    ],
    total: 99.99,
  },

  paymentProcessed: {
    type: 'payment.processed',
    orderId: 'ORD-001',
    amount: 99.99,
    method: 'credit_card',
  },
} as const

/**
 * Edge case payloads for serialization testing
 */
export const edgeCases = {
  // Type boundaries
  primitives: [null, true, false, 0, -0, 1, -1, ''],

  // Number boundaries
  numbers: [
    Number.MAX_SAFE_INTEGER,
    Number.MIN_SAFE_INTEGER,
    Number.EPSILON,
    Infinity,
    -Infinity,
    NaN,
  ],

  // String edge cases
  strings: {
    empty: '',
    whitespace: ' \n\t\r',
    unicode: '你好世界 🚀💻',
    emoji: '🎉🎊🎈',
    controlChars: '\x00\x01\x02\x03',
    quotes: '"\'`\\',
    veryLong: 'x'.repeat(100000),
  },

  // Object structures
  objects: {
    empty: {},
    nested: {
      level1: {
        level2: {
          level3: {
            value: 'deep',
          },
        },
      },
    },
    circular: (() => {
      const obj: any = { a: 1 }
      obj.self = obj
      return obj
    })(),
  },

  // Array structures
  arrays: {
    empty: [],
    sparse: [1, , , 4], // eslint-disable-line no-sparse-arrays
    mixed: [1, 'two', true, null, { five: 5 }, [6]],
  },
} as const

/**
 * Channel names for routing tests
 */
export const channels = {
  standard: 'test-channel',
  empty: '',
  withSlashes: 'app/events/user',
  withDots: 'com.example.events',
  withColons: 'events:user:created',
  specialChars: 'ch:with/special.chars-123_test',
  unicode: '测试频道',
  veryLong: 'channel-' + 'x'.repeat(1000),
} as const

/**
 * Payloads by size for performance testing
 */
export const payloadSizes = {
  tiny: { size: 'tiny', bytes: 10 },
  small: { data: 'x'.repeat(100) }, // ~100 bytes
  medium: { data: 'x'.repeat(10000) }, // ~10KB
  large: { data: 'x'.repeat(1000000) }, // ~1MB
  huge: { data: 'x'.repeat(10000000) }, // ~10MB
} as const

/**
 * Error scenarios
 */
export const errors = {
  network: new Error('Network error'),
  timeout: new Error('Operation timed out'),
  serialization: new Error('Failed to serialize'),
  validation: new Error('Validation failed'),
} as const

/**
 * Time constants for consistent test timing
 */
export const timing = {
  instant: 0,
  fast: 10,
  normal: 100,
  slow: 500,
  verySlow: 2000,
  timeout: 5000,
} as const

/**
 * Concurrency test scenarios
 */
export const concurrency = {
  sequential: 1,
  low: 5,
  medium: 20,
  high: 100,
  extreme: 1000,
} as const

/**
 * Helper to create variations of fixtures
 */
export function withOverrides<T extends Record<string, any>>(base: T, overrides: Partial<T>): T {
  return { ...base, ...overrides }
}

/**
 * Helper to create array of fixtures
 */
export function arrayOf<T>(count: number, factory: (i: number) => T): T[] {
  return Array.from({ length: count }, (_, i) => factory(i))
}

/**
 * Deep clone fixture to avoid mutation
 */
export function clone<T>(fixture: T): T {
  return JSON.parse(JSON.stringify(fixture))
}
