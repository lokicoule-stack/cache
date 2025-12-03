/**
 * Types that can be safely serialized
 */
export type Serializable =
  | string
  | number
  | boolean
  | null
  | Serializable[]
  | { [key: string]: Serializable | undefined }

/**
 * Message handler for typed data
 */
export type MessageHandler<T = Serializable> = (data: T) => void | Promise<void>

/**
 * Internal transport data type (implementation detail)
 */
export type TransportData = Uint8Array

/**
 * Internal transport message handler
 */
export type TransportMessageHandler = (data: TransportData) => void | Promise<void>

/**
 * Transport interface
 */
export interface ITransport {
  readonly name: string
  connect(): Promise<void>
  disconnect(): Promise<void>
  publish(channel: string, data: TransportData): Promise<void>
  subscribe(channel: string, handler: TransportMessageHandler): Promise<void>
  unsubscribe(channel: string): Promise<void>
}
