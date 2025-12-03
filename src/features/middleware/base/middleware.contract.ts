import type { ITransport } from '../../../core/transport'

/**
 * Middleware interface - extends transport to allow chaining
 */
export interface IMiddleware extends ITransport {
  /**
   * The wrapped transport
   */
  readonly transport: ITransport
}
