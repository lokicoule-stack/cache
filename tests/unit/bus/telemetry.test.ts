import { describe, expect, it, vi } from 'vitest'
import type {
  PublishEvent,
  SubscribeEvent,
  UnsubscribeEvent,
  ErrorEvent,
  HandlerExecutionEvent,
} from '@/contracts/bus'
import { BusBuilder } from '@test/builders'
import { FakeTransport } from '@test/doubles'
import { waitFor } from '@test/helpers'

describe('MessageBus Telemetry', () => {
  describe('publish events', () => {
    it('emits before/after events with payload size, codec, and duration', async () => {
      const onPublish = vi.fn()
      const bus = BusBuilder.create().withTelemetry({ onPublish }).build()
      await bus.connect()

      await bus.publish('orders', { id: 1 })

      expect(onPublish).toHaveBeenCalledTimes(2)

      const before = onPublish.mock.calls[0][0] as PublishEvent
      expect(before).toMatchObject({ channel: 'orders', codecUsed: 'json' })
      expect(before.payloadSize).toBeGreaterThan(0)
      expect(before.duration).toBeUndefined()

      const after = onPublish.mock.calls[1][0] as PublishEvent
      expect(after.duration).toBeGreaterThanOrEqual(0)

      await bus.disconnect()
    })
  })

  describe('subscribe/unsubscribe events', () => {
    it('tracks handler count on subscribe and unsubscribe', async () => {
      const onSubscribe = vi.fn()
      const onUnsubscribe = vi.fn()
      const bus = BusBuilder.create().withTelemetry({ onSubscribe, onUnsubscribe }).build()
      await bus.connect()

      const h1 = vi.fn()
      const h2 = vi.fn()
      await bus.subscribe('ch', h1)
      await bus.subscribe('ch', h2)
      await bus.unsubscribe('ch', h1)

      expect((onSubscribe.mock.calls[0][0] as SubscribeEvent).handlerCount).toBe(1)
      expect((onSubscribe.mock.calls[1][0] as SubscribeEvent).handlerCount).toBe(2)
      expect((onUnsubscribe.mock.calls[0][0] as UnsubscribeEvent).handlerCount).toBe(1)

      await bus.disconnect()
    })
  })

  describe('error events', () => {
    it('emits error event on operation failure', async () => {
      const onError = vi.fn()
      const transport = new FakeTransport()
      transport.publish = vi.fn().mockRejectedValue(new Error('Transport down'))

      const bus = BusBuilder.create().withTransport(transport).withTelemetry({ onError }).build()
      await bus.connect()

      await expect(bus.publish('ch', 'test')).rejects.toThrow()

      const event = onError.mock.calls[0][0] as ErrorEvent
      expect(event).toMatchObject({ channel: 'ch', operation: 'publish' })
      expect(event.error.message).toBe('Transport down')

      await bus.disconnect()
    })
  })

  describe('handler execution events', () => {
    it('emits success/failure events for handler execution', async () => {
      const onHandlerExecution = vi.fn()
      const bus = BusBuilder.create()
        .withTelemetry({ onHandlerExecution })
        .withErrorHandler(vi.fn())
        .build()
      await bus.connect()

      await bus.subscribe('ch', vi.fn())
      await bus.subscribe('ch', () => {
        throw new Error('Handler failed')
      })
      await bus.publish('ch', 'test')

      await waitFor(() => onHandlerExecution.mock.calls.length === 2)

      const events = onHandlerExecution.mock.calls.map((c) => c[0] as HandlerExecutionEvent)
      const success = events.find((e) => e.success)
      const failure = events.find((e) => !e.success)

      expect(success?.success).toBe(true)
      expect(failure?.success).toBe(false)
      expect(failure?.error?.message).toBe('Handler failed')

      await bus.disconnect()
    })
  })

  describe('telemetry error isolation', () => {
    it('swallows callback errors without affecting bus operations', async () => {
      const onPublish = vi.fn(() => {
        throw new Error('Telemetry crashed')
      })
      const bus = BusBuilder.create().withTelemetry({ onPublish }).build()
      await bus.connect()

      await expect(bus.publish('ch', 'test')).resolves.toBeUndefined()

      await bus.disconnect()
    })
  })
})
