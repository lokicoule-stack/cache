import type { Middleware } from './middleware.contract'
import type { Transport } from '@/core/transport'
import type { TransportData, TransportMessageHandler } from '@/core/types'

export abstract class TransportMiddleware implements Middleware {
  constructor(readonly transport: Transport) {}

  get name(): string {
    return this.transport.name
  }

  async connect(): Promise<void> {
    return this.transport.connect()
  }

  async disconnect(): Promise<void> {
    return this.transport.disconnect()
  }

  async publish(channel: string, data: TransportData): Promise<void> {
    return this.transport.publish(channel, data)
  }

  async subscribe(channel: string, handler: TransportMessageHandler): Promise<void> {
    return this.transport.subscribe(channel, handler)
  }

  async unsubscribe(channel: string): Promise<void> {
    return this.transport.unsubscribe(channel)
  }
}
