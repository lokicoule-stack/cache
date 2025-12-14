/**
 * Type safety tests for message bus system
 *
 * Tests compile-time type inference and validation to ensure:
 * - Channel names are enforced from schema
 * - Payload types match their channels
 * - Invalid usage produces TypeScript errors
 *
 * Philosophy: Test the contract, not the implementation
 */
import { describe, expectTypeOf, it } from 'vitest'
import { BusManager } from '@/core/bus/bus-manager'
import { MessageBus } from '@/core/bus/message-bus'
import { MemoryTransport } from '@/infrastructure/transports/memory/memory-transport'

// ============================================================================
// Test Schema
// ============================================================================

type TestSchema = {
  'user:created': { id: string; email: string }
  'user:deleted': { id: string }
  'order:placed': { orderId: string; items: string[]; total: number }
}

type ComplexSchema = {
  'nested:event': { user: { profile: { name: string; age: number } } }
  'optional:event': { required: string; optional?: number }
  'union:event': { status: 'pending' | 'completed' | 'failed' }
}

const createTransport = () => new MemoryTransport()

// ============================================================================
// BusManager Type Safety
// ============================================================================

describe('BusManager Type Safety', () => {
  it('enforces valid channels and payloads', () => {
    const manager = new BusManager<TestSchema>({
      default: 'main',
      transports: { main: { transport: createTransport() } },
    })

    // Valid operations
    void manager.publish('user:created', { id: '1', email: 'test@example.com' })
    void manager.publish('user:deleted', { id: '1' })
    void manager.publish('order:placed', { orderId: '1', items: ['a'], total: 100 })

    // Invalid channel names
    // @ts-expect-error - Channel not in schema
    void manager.publish('invalid:channel', {})

    // @ts-expect-error - Typo in channel name
    void manager.publish('user:creatd', { id: '1', email: 'test@example.com' })

    // Invalid payloads
    // @ts-expect-error - Missing required field 'email'
    void manager.publish('user:created', { id: '1' })

    // @ts-expect-error - Wrong type for 'id'
    void manager.publish('user:created', { id: 123, email: 'test@example.com' })

    // @ts-expect-error - Missing all required fields
    void manager.publish('user:deleted', {})

    // @ts-expect-error - Extra property not in schema
    void manager.publish('user:deleted', { id: '1', extra: 'field' })
  })

  it('infers correct handler parameter types', async () => {
    const manager = new BusManager<TestSchema>({
      default: 'main',
      transports: { main: { transport: createTransport() } },
    })

    await manager.subscribe('user:created', (payload) => {
      expectTypeOf(payload).toEqualTypeOf<{ id: string; email: string }>()
      expectTypeOf(payload.id).toEqualTypeOf<string>()
      expectTypeOf(payload.email).toEqualTypeOf<string>()
    })

    await manager.subscribe('order:placed', (payload) => {
      expectTypeOf(payload).toEqualTypeOf<{
        orderId: string
        items: string[]
        total: number
      }>()
    })
  })

  it('maintains type safety through bus references', () => {
    const manager = new BusManager<TestSchema>({
      default: 'main',
      transports: { main: { transport: createTransport() } },
    })

    const bus = manager.use('main')

    // Valid
    void bus.publish('user:created', { id: '1', email: 'test@example.com' })

    // @ts-expect-error - Invalid channel
    void bus.publish('invalid', {})

    // @ts-expect-error - Wrong payload
    void bus.publish('user:created', { id: 123, email: 'test@example.com' })
  })
})

// ============================================================================
// MessageBus Type Safety
// ============================================================================

describe('MessageBus Type Safety', () => {
  it('enforces schema constraints', () => {
    const bus = new MessageBus<TestSchema>({ transport: createTransport() })

    // Valid
    void bus.publish('user:created', { id: '1', email: 'test@example.com' })
    void bus.publish('user:deleted', { id: '1' })

    // @ts-expect-error - Channel not in schema
    void bus.publish('nonexistent', { data: 'test' })

    // @ts-expect-error - Wrong payload structure
    void bus.publish('user:deleted', { email: 'test@example.com' })

    // @ts-expect-error - Wrong type
    void bus.publish('user:created', { id: 123, email: 'test@example.com' })
  })

  it('infers handler types correctly', async () => {
    const bus = new MessageBus<TestSchema>({ transport: createTransport() })

    await bus.subscribe('user:created', (payload) => {
      expectTypeOf(payload).toEqualTypeOf<{ id: string; email: string }>()
    })

    await bus.subscribe('order:placed', (payload) => {
      expectTypeOf(payload.items).toEqualTypeOf<string[]>()
      expectTypeOf(payload.total).toEqualTypeOf<number>()
    })
  })
})

// ============================================================================
// Complex Type Scenarios
// ============================================================================

describe('Complex Type Handling', () => {
  it('handles nested object structures', () => {
    const bus = new MessageBus<ComplexSchema>({ transport: createTransport() })

    // Valid nested structure
    void bus.publish('nested:event', {
      user: { profile: { name: 'John', age: 30 } },
    })

    // @ts-expect-error - Missing nested property
    void bus.publish('nested:event', { user: { name: 'John' } })

    void bus.publish('nested:event', {
      // @ts-expect-error - Wrong nested type
      user: { profile: { name: 123, age: 30 } },
    })
  })

  it('handles optional properties', () => {
    const bus = new MessageBus<ComplexSchema>({ transport: createTransport() })

    // Both valid
    void bus.publish('optional:event', { required: 'test' })
    void bus.publish('optional:event', { required: 'test', optional: 42 })

    // @ts-expect-error - Missing required field
    void bus.publish('optional:event', { optional: 42 })

    // @ts-expect-error - Wrong optional type
    void bus.publish('optional:event', { required: 'test', optional: 'wrong' })
  })

  it('handles union types', () => {
    const bus = new MessageBus<ComplexSchema>({ transport: createTransport() })

    // All union variants valid
    void bus.publish('union:event', { status: 'pending' })
    void bus.publish('union:event', { status: 'completed' })
    void bus.publish('union:event', { status: 'failed' })

    // @ts-expect-error - Invalid union value
    void bus.publish('union:event', { status: 'invalid' })

    // @ts-expect-error - Wrong type
    void bus.publish('union:event', { status: 123 })
  })

  it('handles array types', () => {
    type ArraySchema = { event: { items: Array<{ id: number; name: string }> } }
    const bus = new MessageBus<ArraySchema>({ transport: createTransport() })

    // Valid
    void bus.publish('event', {
      items: [
        { id: 1, name: 'Item 1' },
        { id: 2, name: 'Item 2' },
      ],
    })

    // @ts-expect-error - Wrong array element type
    void bus.publish('event', { items: [{ id: '1', name: 'Item 1' }] })

    // @ts-expect-error - Wrong array structure
    void bus.publish('event', { items: [1, 2, 3] })
  })
})

// ============================================================================
// Edge Cases
// ============================================================================

describe('Edge Cases', () => {
  it('handles null values in payload', () => {
    type NullSchema = { event: { value: string | null } }
    const bus = new MessageBus<NullSchema>({ transport: createTransport() })

    void bus.publish('event', { value: null })
    void bus.publish('event', { value: 'test' })

    // @ts-expect-error - undefined not allowed
    void bus.publish('event', { value: undefined })
  })

  it('handles literal types', () => {
    type LiteralSchema = { event: { type: 'SUCCESS'; code: 200 } }
    const bus = new MessageBus<LiteralSchema>({ transport: createTransport() })

    void bus.publish('event', { type: 'SUCCESS', code: 200 })

    // @ts-expect-error - Wrong literal string
    void bus.publish('event', { type: 'FAILURE', code: 200 })

    // @ts-expect-error - Wrong literal number
    void bus.publish('event', { type: 'SUCCESS', code: 404 })
  })

  it('handles empty object payloads', () => {
    type EmptySchema = { event: Record<string, never> }
    const bus = new MessageBus<EmptySchema>({ transport: createTransport() })

    void bus.publish('event', {})

    // @ts-expect-error - No properties allowed
    void bus.publish('event', { data: 'test' })
  })
})

// ============================================================================
// Without Schema (Backward Compatibility)
// ============================================================================

describe('Without Type Schema', () => {
  it('accepts any channel and serializable payload', () => {
    const manager = new BusManager({
      default: 'main',
      transports: { main: { transport: createTransport() } },
    })

    const bus = new MessageBus({ transport: createTransport() })

    // All valid when no schema
    void manager.publish('any-channel', { any: 'data' })
    void manager.publish('another', 'string')
    void manager.publish('numbers', 123)
    void manager.publish('arrays', [1, 2, 3])
    void manager.publish('nested', { deep: { object: true } })

    void bus.publish('flexible', { data: 'anything' })
    void bus.publish('untyped', 42)
  })
})
