import type { Transport } from '@/contracts/transport'

/**
 * Middleware abstraction for wrapping Transport.
 *
 * @remarks
 * Enables composition of transport layers with additional functionality.
 *
 * @public
 */
export interface Middleware extends Transport {
  /** Wrapped transport instance */
  readonly transport: Transport
}
