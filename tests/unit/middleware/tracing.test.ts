/* eslint-disable @typescript-eslint/require-await */
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { SpanKind } from '@opentelemetry/api'
import { TracingMiddleware } from '@/core/middleware/tracing/tracing-middleware'
import { FakeTransport, FakeTracingApi } from '@test/doubles'
import { TestData, TracedEnvelopeBuilder, TRACING_MAGIC } from '@test/builders'
import { waitFor } from '@test/helpers'

describe('TracingMiddleware', () => {
  let transport: FakeTransport
  let tracingApi: FakeTracingApi
  let middleware: TracingMiddleware

  beforeEach(async () => {
    transport = new FakeTransport()
    tracingApi = new FakeTracingApi()
    middleware = new TracingMiddleware(transport, { tracer: tracingApi })
    await middleware.connect()
  })

  describe('publish', () => {
    it.each([
      { topic: 'orders', payload: TestData.small },
      { topic: 'users', payload: new Uint8Array([1, 2, 3]) },
      { topic: 'events', payload: new Uint8Array([]) },
    ])('creates producer span for $topic', async ({ topic, payload }) => {
      await middleware.publish(topic, payload)

      const span = tracingApi.getLastSpan()
      expect(span!.name).toBe(`${topic} publish`)
      expect(span!.options.kind).toBe(SpanKind.PRODUCER)
      expect(span!.ended).toBe(true)
    })

    it('injects trace context and wraps payload', async () => {
      await middleware.publish('orders', TestData.small)

      // Verify trace injection
      expect(tracingApi.injectedCarriers[0]).toHaveProperty('traceparent')

      // Verify envelope wrapping
      const msg = transport.getLastMessage()
      expect(Array.from(msg!.data.slice(0, 2))).toEqual([TRACING_MAGIC.T, TRACING_MAGIC.R])

      const envelope = JSON.parse(new TextDecoder().decode(msg!.data.slice(2)))
      expect(envelope.p).toEqual(Array.from(TestData.small))
      expect(envelope.t).toHaveProperty('traceparent')
    })

    it('ends span on error', async () => {
      vi.spyOn(transport, 'publish').mockRejectedValue(new Error('fail'))

      await expect(middleware.publish('orders', TestData.small)).rejects.toThrow('fail')
      expect(tracingApi!.getLastSpan()!.ended).toBe(true)
    })
  })

  describe('subscribe', () => {
    const testCases = [
      {
        name: 'traced message: extracts context and creates consumer span',
        message: TracedEnvelopeBuilder.valid(),
        expectedPayload: TestData.small,
        expectSpan: true,
        expectExtraction: true,
      },
      {
        name: 'untraced message: passes through without span',
        message: TracedEnvelopeBuilder.untraced(),
        expectedPayload: new Uint8Array([10, 20, 30]),
        expectSpan: false,
        expectExtraction: false,
      },
      {
        name: 'malformed message: passes through as-is',
        message: TracedEnvelopeBuilder.malformed(),
        expectedPayload: new Uint8Array([0x54, 0x52, 0xff, 0xff]),
        expectSpan: false,
        expectExtraction: false,
      },
    ]

    it.each(testCases)(
      '$name',
      async ({ message, expectedPayload, expectSpan, expectExtraction }) => {
        const received: Uint8Array[] = []
        await middleware.subscribe('orders', async (data) => {
          received.push(data)
        })

        transport.simulateMessage('orders', message)
        await waitFor(() => received.length > 0)

        expect(Array.from(received[0])).toEqual(Array.from(expectedPayload))
        expect(tracingApi.spans).toHaveLength(expectSpan ? 1 : 0)
        expect(tracingApi.extractedCarriers).toHaveLength(expectExtraction ? 1 : 0)

        if (expectSpan) {
          expect(tracingApi.getLastSpan()!.name).toBe('orders process')
          expect(tracingApi.getLastSpan()!.options.kind).toBe(SpanKind.CONSUMER)
        }
      },
    )
  })

  describe('round-trip', () => {
    it('preserves payload and links spans', async () => {
      const received: Uint8Array[] = []
      await middleware.subscribe('orders', async (data) => {
        received.push(data)
      })

      const original = new Uint8Array([1, 2, 3, 4, 5])
      await middleware.publish('orders', original)

      await waitFor(() => received.length > 0)

      // Payload preservation
      expect(Array.from(received[0])).toEqual(Array.from(original))

      // Span linking
      expect(tracingApi.getProducerSpans()).toHaveLength(1)
      expect(tracingApi.getConsumerSpans()).toHaveLength(1)
      expect(tracingApi.allSpansEnded()).toBe(true)
    })
  })

  describe('configuration', () => {
    it.each([
      { opts: { recordPayloadSize: true }, desc: 'enables payload recording' },
      { opts: { serviceName: 'svc' }, desc: 'accepts service name' },
      { opts: {}, desc: 'works with defaults' },
    ])('$desc', async ({ opts }) => {
      const mw = new TracingMiddleware(transport, { tracer: tracingApi, ...opts })
      await mw.connect()
      await mw.publish('test', TestData.small)

      expect(tracingApi.spans).toHaveLength(1)
    })
  })
})
