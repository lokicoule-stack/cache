import type { Transport } from '@/core/transport'

/**
 * Middleware interface - extends transport to allow chaining
 */
export interface Middleware extends Transport {
  /**
   * The wrapped transport
   */
  readonly transport: Transport
}
