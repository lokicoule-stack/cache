import type { Serializable } from './serializable'

/**
 * Callback for processing messages.
 * @public
 */
export type MessageHandler<T = Serializable> = (data: T) => void | Promise<void>

/** @public */
export type TransportData = Uint8Array

/** @public */
export type TransportMessageHandler = (data: TransportData) => void | Promise<void>
