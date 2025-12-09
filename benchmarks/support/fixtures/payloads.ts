import type { Serializable } from '@/types/serializable'

export type AckPayload = Serializable & {
  ok: boolean
}

export type PingPayload = Serializable & {
  id: string
  timestamp: number
}

export type EventPayload = Serializable & {
  id: string
  type: string
  timestamp: string
}

export type UserActionPayload = Serializable & {
  userId: string
  sessionId: string
  action: string
  timestamp: string
  metadata: Record<string, string>
}

export type OrderPayload = Serializable & {
  userId: string
  orderId: string
  items: Array<{ id: string; qty: number; price: number }>
  total: number
  timestamp: string
}

export type AnalyticsSessionPayload = Serializable & {
  sessionId: string
  userId: string
  events: Array<{
    type: string
    timestamp: string
    data: Record<string, unknown>
  }>
  metadata: {
    userAgent: string
    ip: string
    country: string
  }
}

export type DatasetPayload = Serializable & {
  dataset: Array<{
    id: number
    values: number[]
    metadata: Record<string, string>
  }>
}

export const payloads = {
  ack: (): AckPayload => ({
    ok: true,
  }),

  ping: (): PingPayload => ({
    id: 'ping-001',
    timestamp: Date.now(),
  }),

  event: (): EventPayload => ({
    id: 'evt-123',
    type: 'click',
    timestamp: new Date().toISOString(),
  }),

  userAction: (): UserActionPayload => ({
    userId: 'user-456',
    sessionId: 'session-abc',
    action: 'button_click',
    timestamp: new Date().toISOString(),
    metadata: {
      component: 'checkout-button',
      variant: 'primary',
    },
  }),

  order: (itemCount: number = 10): OrderPayload => ({
    userId: 'user-456',
    orderId: 'order-789',
    items: Array.from({ length: itemCount }, (_, i) => ({
      id: `item-${i}`,
      qty: i + 1,
      price: 9.99 * (i + 1),
    })),
    total: itemCount * 9.99 * ((itemCount + 1) / 2),
    timestamp: new Date().toISOString(),
  }),

  analyticsSession: (eventCount: number = 100): AnalyticsSessionPayload => ({
    sessionId: 'session-abc',
    userId: 'user-456',
    events: Array.from({ length: eventCount }, (_, i) => ({
      type: 'page_view',
      timestamp: new Date(Date.now() - i * 1000).toISOString(),
      data: {
        page: `/page-${i}`,
        duration: Math.random() * 10000,
        scrollDepth: Math.random() * 100,
      },
    })),
    metadata: {
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
      ip: '192.168.1.1',
      country: 'US',
    },
  }),

  dataset: (recordCount: number = 500, valuesPerRecord: number = 20): DatasetPayload => ({
    dataset: Array.from({ length: recordCount }, (_, i) => ({
      id: i,
      values: Array.from({ length: valuesPerRecord }, () => Math.random() * 100),
      metadata: {
        source: `source-${i}`,
        version: '1.0',
        timestamp: new Date().toISOString(),
      },
    })),
  }),
} as const

export const standardPayloads = {
  nano: payloads.ack(),
  tiny: payloads.ping(),
  small: payloads.event(),
  medium: payloads.userAction(),
  large: payloads.order(10),
  xlarge: payloads.order(50),
  xxlarge: payloads.analyticsSession(100),
  huge: payloads.analyticsSession(500),
  massive: payloads.dataset(500, 20),
  enormous: payloads.dataset(1000, 50),
} as const

export type PayloadSize = keyof typeof standardPayloads
