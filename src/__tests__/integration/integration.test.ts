import { beforeEach, describe, expect, it, vi } from 'vitest'

import { Bus } from '@/core/bus'
import { BusManager } from '@/core/bus/bus-manager'
import { MemoryTransport } from '@/infrastructure/transports/memory'
import { delay, setupTestEnvironment, waitFor } from '../utils/test-helpers'

setupTestEnvironment()

describe('Integration Tests', () => {
  describe('Bus with MemoryTransport', () => {
    let transport: MemoryTransport
    let bus: Bus

    beforeEach(async () => {
      transport = new MemoryTransport()
      bus = new Bus({ transport, codec: 'json' })
      await bus.connect()
    })

    afterEach(async () => {
      await bus.disconnect()
    })

    it('should complete full publish-subscribe cycle', async () => {
      const handler = vi.fn()
      await bus.subscribe('users:created', handler)

      const userData = {
        id: 1,
        name: 'Alice',
        email: 'alice@example.com',
      }

      await bus.publish('users:created', userData)

      await waitFor(() => handler.mock.calls.length > 0)
      expect(handler).toHaveBeenCalledWith(userData)
    })

    it('should handle multiple channels independently', async () => {
      const userHandler = vi.fn()
      const orderHandler = vi.fn()

      await bus.subscribe('users', userHandler)
      await bus.subscribe('orders', orderHandler)

      await bus.publish('users', { id: 1, name: 'Alice' })
      await bus.publish('orders', { id: 100, amount: 99.99 })

      await waitFor(() => userHandler.mock.calls.length > 0 && orderHandler.mock.calls.length > 0)

      expect(userHandler).toHaveBeenCalledWith({ id: 1, name: 'Alice' })
      expect(orderHandler).toHaveBeenCalledWith({ id: 100, amount: 99.99 })
    })

    it('should support request-response pattern', async () => {
      await bus.subscribe('rpc:calculate', async (request: { a: number; b: number }) => {
        const result = request.a + request.b
        await bus.publish(`rpc:response:${request.a}-${request.b}`, { result })
      })

      const responseHandler = vi.fn()
      await bus.subscribe('rpc:response:5-3', responseHandler)

      await bus.publish('rpc:calculate', { a: 5, b: 3 })

      await waitFor(() => responseHandler.mock.calls.length > 0)
      expect(responseHandler).toHaveBeenCalledWith({ result: 8 })
    })

    it('should handle event sourcing pattern', async () => {
      const events: Array<{ type: string; payload: unknown }> = []

      const eventStore = vi.fn((event: { type: string; payload: unknown }) => {
        events.push(event)
      })

      await bus.subscribe('events', eventStore)

      await bus.publish('events', { type: 'USER_CREATED', payload: { id: 1 } })
      await bus.publish('events', { type: 'ORDER_PLACED', payload: { orderId: 100 } })
      await bus.publish('events', { type: 'PAYMENT_PROCESSED', payload: { amount: 50 } })

      await waitFor(() => events.length === 3)

      expect(events).toHaveLength(3)
      expect(events[0].type).toBe('USER_CREATED')
      expect(events[1].type).toBe('ORDER_PLACED')
      expect(events[2].type).toBe('PAYMENT_PROCESSED')
    })

    it('should support pub-sub with wildcard-like channels', async () => {
      const allUsersHandler = vi.fn()
      const createdHandler = vi.fn()
      const updatedHandler = vi.fn()

      await bus.subscribe('users:created', createdHandler)
      await bus.subscribe('users:updated', updatedHandler)

      await bus.publish('users:created', { id: 1 })
      await bus.publish('users:updated', { id: 1 })

      await waitFor(
        () => createdHandler.mock.calls.length > 0 && updatedHandler.mock.calls.length > 0,
      )

      expect(createdHandler).toHaveBeenCalledTimes(1)
      expect(updatedHandler).toHaveBeenCalledTimes(1)
    })
  })

  describe('BusManager integration', () => {
    let manager: BusManager<{
      events: { transport: MemoryTransport; codec: 'json' }
      commands: { transport: MemoryTransport; codec: 'msgpack' }
    }>

    beforeEach(() => {
      manager = new BusManager({
        default: 'events',
        transports: {
          events: { transport: new MemoryTransport(), codec: 'json' },
          commands: { transport: new MemoryTransport(), codec: 'msgpack' },
        },
      })
    })

    afterEach(async () => {
      await manager.stop()
    })

    it('should route messages to correct bus', async () => {
      await manager.start()

      const eventsBus = manager.use('events')
      const commandsBus = manager.use('commands')

      const eventsHandler = vi.fn()
      const commandsHandler = vi.fn()

      await eventsBus.subscribe('test', eventsHandler)
      await commandsBus.subscribe('test', commandsHandler)

      await eventsBus.publish('test', 'event-data')
      await commandsBus.publish('test', 'command-data')

      await waitFor(
        () => eventsHandler.mock.calls.length > 0 && commandsHandler.mock.calls.length > 0,
      )

      expect(eventsHandler).toHaveBeenCalledWith('event-data')
      expect(commandsHandler).toHaveBeenCalledWith('command-data')
    })

    it('should implement CQRS pattern', async () => {
      await manager.start()

      const commandBus = manager.use('commands')
      const eventBus = manager.use('events')

      const commandResults: unknown[] = []
      const events: unknown[] = []

      await commandBus.subscribe('commands:create-user', async (cmd: { name: string }) => {
        commandResults.push({ success: true, userId: 1 })
        await eventBus.publish('events:user-created', {
          userId: 1,
          name: cmd.name,
        })
      })

      await eventBus.subscribe('events:user-created', (event: unknown) => {
        events.push(event)
      })

      await commandBus.publish('commands:create-user', { name: 'Alice' })

      await waitFor(() => commandResults.length > 0 && events.length > 0)

      expect(commandResults).toHaveLength(1)
      expect(events).toHaveLength(1)
      expect(events[0]).toEqual({ userId: 1, name: 'Alice' })
    })

    it('should support multi-bus orchestration', async () => {
      await manager.start()

      const eventBus = manager.use('events')
      const commandBus = manager.use('commands')

      const workflow: string[] = []

      await commandBus.subscribe('step1', async () => {
        workflow.push('step1:started')
        await eventBus.publish('step1:completed', {})
      })

      await eventBus.subscribe('step1:completed', async () => {
        workflow.push('step1:completed')
        await commandBus.publish('step2', {})
      })

      await commandBus.subscribe('step2', async () => {
        workflow.push('step2:started')
        await eventBus.publish('step2:completed', {})
      })

      await eventBus.subscribe('step2:completed', () => {
        workflow.push('step2:completed')
      })

      await commandBus.publish('step1', {})

      await waitFor(() => workflow.length === 4, 2000)

      expect(workflow).toEqual([
        'step1:started',
        'step1:completed',
        'step2:started',
        'step2:completed',
      ])
    })
  })

  describe('real-world scenarios', () => {
    it('should handle order processing workflow', async () => {
      const transport = new MemoryTransport()
      const bus = new Bus({ transport, codec: 'json' })
      await bus.connect()

      const orderStates = new Map<number, string>()
      const inventory = new Map<number, number>([
        [1, 10],
        [2, 5],
      ])

      await bus.subscribe(
        'order:placed',
        async (order: { id: number; productId: number; quantity: number }) => {
          orderStates.set(order.id, 'placed')
          await bus.publish('inventory:check', order)
        },
      )

      await bus.subscribe(
        'inventory:check',
        async (order: { id: number; productId: number; quantity: number }) => {
          const available = inventory.get(order.productId) || 0
          if (available >= order.quantity) {
            await bus.publish('inventory:reserved', order)
          } else {
            await bus.publish('order:rejected', {
              orderId: order.id,
              reason: 'insufficient inventory',
            })
          }
        },
      )

      await bus.subscribe(
        'inventory:reserved',
        async (order: { id: number; productId: number; quantity: number }) => {
          orderStates.set(order.id, 'reserved')
          inventory.set(order.productId, (inventory.get(order.productId) || 0) - order.quantity)
          await bus.publish('payment:process', order)
        },
      )

      await bus.subscribe('payment:process', async (order: { id: number }) => {
        await delay(10)
        await bus.publish('payment:completed', order)
      })

      await bus.subscribe('payment:completed', (order: { id: number }) => {
        orderStates.set(order.id, 'completed')
      })

      await bus.subscribe('order:rejected', (data: { orderId: number }) => {
        orderStates.set(data.orderId, 'rejected')
      })

      await bus.publish('order:placed', { id: 1, productId: 1, quantity: 2 })
      await bus.publish('order:placed', { id: 2, productId: 2, quantity: 10 })

      await waitFor(
        () => orderStates.get(1) === 'completed' && orderStates.get(2) === 'rejected',
        2000,
      )

      expect(orderStates.get(1)).toBe('completed')
      expect(orderStates.get(2)).toBe('rejected')
      expect(inventory.get(1)).toBe(8)
      expect(inventory.get(2)).toBe(5)

      await bus.disconnect()
    })

    it('should implement saga pattern', async () => {
      const transport = new MemoryTransport()
      const bus = new Bus({ transport, codec: 'json' })
      await bus.connect()

      const sagaState = {
        bookingCreated: false,
        paymentProcessed: false,
        emailSent: false,
        completed: false,
        compensated: false,
      }

      await bus.subscribe('saga:start', async () => {
        await bus.publish('booking:create', {})
      })

      await bus.subscribe('booking:create', async () => {
        sagaState.bookingCreated = true
        await bus.publish('payment:process', {})
      })

      await bus.subscribe('payment:process', async () => {
        sagaState.paymentProcessed = true
        await bus.publish('email:send', {})
      })

      await bus.subscribe('email:send', async () => {
        sagaState.emailSent = true
        await bus.publish('saga:complete', {})
      })

      await bus.subscribe('saga:complete', () => {
        sagaState.completed = true
      })

      await bus.publish('saga:start', {})

      await waitFor(() => sagaState.completed, 1000)

      expect(sagaState.bookingCreated).toBe(true)
      expect(sagaState.paymentProcessed).toBe(true)
      expect(sagaState.emailSent).toBe(true)
      expect(sagaState.completed).toBe(true)

      await bus.disconnect()
    })

    it('should handle distributed tracing scenario', async () => {
      const transport = new MemoryTransport()
      const bus = new Bus({ transport, codec: 'json' })
      await bus.connect()

      interface TracedMessage {
        traceId: string
        spanId: string
        parentSpanId?: string
        data: unknown
      }

      const traces: TracedMessage[] = []

      const wrapHandler = (name: string, handler: (msg: TracedMessage) => Promise<void>) => {
        return async (msg: TracedMessage) => {
          const span: TracedMessage = {
            ...msg,
            spanId: `${name}-${Date.now()}`,
            parentSpanId: msg.spanId,
          }
          traces.push(span)
          await handler(span)
        }
      }

      await bus.subscribe(
        'service-a',
        wrapHandler('service-a', async (msg) => {
          await bus.publish('service-b', msg)
        }),
      )

      await bus.subscribe(
        'service-b',
        wrapHandler('service-b', async (msg) => {
          await bus.publish('service-c', msg)
        }),
      )

      await bus.subscribe(
        'service-c',
        wrapHandler('service-c', async () => {}),
      )

      const rootMessage: TracedMessage = {
        traceId: 'trace-123',
        spanId: 'root',
        data: { request: 'test' },
      }

      await bus.publish('service-a', rootMessage)

      await waitFor(() => traces.length === 3, 1000)

      expect(traces).toHaveLength(3)
      expect(traces[0].parentSpanId).toBe('root')
      expect(traces[1].parentSpanId).toContain('service-a')
      expect(traces[2].parentSpanId).toContain('service-b')

      await bus.disconnect()
    })

    it('should implement circuit breaker pattern', async () => {
      const transport = new MemoryTransport()
      const bus = new Bus({ transport, codec: 'json' })
      await bus.connect()

      let failureCount = 0
      const threshold = 3
      let circuitOpen = false

      await bus.subscribe('external:call', async () => {
        if (circuitOpen) {
          await bus.publish('circuit:open', { message: 'Circuit breaker is open' })
          return
        }

        const shouldFail = failureCount < 5
        if (shouldFail) {
          failureCount++
          if (failureCount >= threshold) {
            circuitOpen = true
            await bus.publish('circuit:opened', { failures: failureCount })
          }
          throw new Error('External service failed')
        } else {
          await bus.publish('external:success', {})
        }
      })

      const circuitEvents: string[] = []

      await bus.subscribe('circuit:opened', () => {
        circuitEvents.push('opened')
      })

      await bus.subscribe('circuit:open', () => {
        circuitEvents.push('rejected')
      })

      for (let i = 0; i < 6; i++) {
        await bus.publish('external:call', {})
        await delay(10)
      }

      await waitFor(() => circuitEvents.length >= 4, 1000)

      expect(circuitEvents).toContain('opened')
      expect(circuitEvents).toContain('rejected')

      await bus.disconnect()
    })
  })

  describe('codec switching', () => {
    it('should work with both JSON and MessagePack codecs', async () => {
      const jsonBus = new Bus({
        transport: new MemoryTransport(),
        codec: 'json',
      })

      const msgpackBus = new Bus({
        transport: new MemoryTransport(),
        codec: 'msgpack',
      })

      await jsonBus.connect()
      await msgpackBus.connect()

      const jsonHandler = vi.fn()
      const msgpackHandler = vi.fn()

      await jsonBus.subscribe('test', jsonHandler)
      await msgpackBus.subscribe('test', msgpackHandler)

      const testData = { id: 1, name: 'Test', nested: { value: 42 } }

      await jsonBus.publish('test', testData)
      await msgpackBus.publish('test', testData)

      await waitFor(() => jsonHandler.mock.calls.length > 0 && msgpackHandler.mock.calls.length > 0)

      expect(jsonHandler).toHaveBeenCalledWith(testData)
      expect(msgpackHandler).toHaveBeenCalledWith(testData)

      await jsonBus.disconnect()
      await msgpackBus.disconnect()
    })
  })
})
