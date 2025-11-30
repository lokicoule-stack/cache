/**
 * @lokiverse/bus - Type-safe distributed message bus
 *
 * Features:
 * - Type-safe pub/sub with generics
 * - Binary protocol (30-60% smaller than JSON)
 * - Built-in retry queue with hooks
 * - Multiple transports (memory, redis)
 * - Zero dependencies (ioredis optional)
 *
 * @example
 * ```ts
 * import { createBus, redis } from '@lokiverse/bus'
 *
 * interface MyMessages {
 *   'user:login': { userId: string }
 *   'user:logout': { userId: string }
 * }
 *
 * const bus = createBus<MyMessages>({
 *   transport: redis(),
 *   channel: 'app',
 *   instanceId: 'server-1'
 * })
 *
 * await bus.start()
 * bus.subscribe('user:login', (payload) => {
 *   console.log(payload.userId)
 * })
 * await bus.publish('user:login', { userId: 'alice' })
 * ```
 */

export { Bus, createBus } from './bus'
export type {
  MessageMap,
  MessageType,
  MessagePayload,
  MessageHandler,
  BusConfig,
  Unsubscribe,
} from './bus'

export { createMessage, serializeBinary, deserializeBinary, serializeJSON, deserializeJSON } from './message'
export type { Message } from './message'

export { BusError } from './transport'
export type { ITransport, TransportState, MessageHandler as TransportMessageHandler } from './transport'

export { BaseTransport } from './base-transport'

export { MemoryTransport, memory, createMemoryTransport } from './transports/memory'
export { RedisTransport, redis, createRedisTransport } from './transports/redis'
export type { RedisTransportConfig } from './transports/redis'

export { RetryQueue } from './retry-queue'
export type { RetryQueueOptions } from './retry-queue'
