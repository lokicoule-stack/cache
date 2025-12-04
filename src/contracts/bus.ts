import type { MessageHandler, Serializable } from '../types'

export interface Bus {
  connect(): Promise<void>
  disconnect(): Promise<void>
  publish<T extends Serializable>(channel: string, data: T): Promise<void>
  subscribe<T extends Serializable>(channel: string, handler: MessageHandler<T>): Promise<void>
  unsubscribe(channel: string, handler?: MessageHandler): Promise<void>
}
