/** Transport connection state */
export const TRANSPORT_STATES = {
  DISCONNECTED: 'DISCONNECTED',
  CONNECTING: 'CONNECTING',
  CONNECTED: 'CONNECTED',
  ERROR: 'ERROR',
} as const

export type TransportState = typeof TRANSPORT_STATES[keyof typeof TRANSPORT_STATES]

/** Message handler callback */
export type MessageHandler = (data: Uint8Array) => void | Promise<void>

/** Unsubscribe function */
export type Unsubscribe = () => Promise<void>

/** Transport interface for pub/sub */
export interface ITransport {
  readonly name: string
  readonly state: TransportState

  connect(): Promise<void>
  disconnect(): Promise<void>
  publish(channel: string, data: Uint8Array): Promise<void>
  subscribe(channel: string, handler: MessageHandler): Promise<Unsubscribe>
  unsubscribe(channel: string): Promise<void>
}

/** Bus error with optional cause */
export class BusError extends Error {
  constructor(
    message: string,
    public override readonly cause?: Error,
  ) {
    super(message)
    this.name = 'BusError'
  }
}
