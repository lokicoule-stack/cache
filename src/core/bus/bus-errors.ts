/**
 * Error codes for message bus operations.
 * @public
 */
export const BusErrorCode = {
  /** Generic bus error */
  BUS_ERROR: 'BUS_ERROR',
  
  /** Bus not connected */
  NOT_CONNECTED: 'NOT_CONNECTED',
  
  /** Bus configuration invalid */
  INVALID_CONFIG: 'INVALID_CONFIG',
  
  /** Handler execution failed */
  HANDLER_FAILED: 'HANDLER_FAILED',
  
  /** Transport operation failed */
  TRANSPORT_FAILED: 'TRANSPORT_FAILED',
  
  /** Channel operation failed */
  CHANNEL_ERROR: 'CHANNEL_ERROR',
} as const;

/**
 * @public
 */
export type BusErrorCode = typeof BusErrorCode[keyof typeof BusErrorCode];

/**
 * Context for bus errors.
 * @public
 */
export interface BusErrorContext {
  /** Additional non-sensitive metadata */
  [key: string]: unknown

  /** Channel name where error occurred */
  channel?: string
  
  /** Operation being performed */
  operation?: string
  
  /** Transport name */
  transport?: string
  
  /** Connection state */
  connected?: boolean
}

/**
 * Base error for all message bus operations.
 *
 * @remarks
 * Extends native Error with structured error codes and optional context.
 * Use the `code` property for programmatic error handling.
 *
 * @example
 * ```ts
 * try {
 *   await bus.publish('events', data);
 * } catch (err) {
 *   if (err instanceof BusError) {
 *     switch (err.code) {
 *       case BusErrorCode.NOT_CONNECTED:
 *         await bus.connect();
 *         break;
 *       case BusErrorCode.HANDLER_FAILED:
 *         logger.error('Handler error', err.context);
 *         break;
 *     }
 *   }
 * }
 * ```
 *
 * @public
 */
export class BusError extends Error {
  /** Machine-readable error code */
  readonly code: BusErrorCode;

  /** Additional error context */
  readonly context?: BusErrorContext;

  constructor(
    message: string,
    code: BusErrorCode = BusErrorCode.BUS_ERROR,
    options?: ErrorOptions & { context?: BusErrorContext },
  ) {
    super(message, options);

    this.name = 'BusError';
    this.code = code;
    this.context = options?.context;

    Error.captureStackTrace?.(this, this.constructor);
  }

  /** @internal */
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      context: this.context,
      stack: this.stack,
    };
  }
}

/**
 * Configuration error for message bus.
 * 
 * @remarks
 * Thrown during bus initialization when configuration is invalid.
 * These errors indicate developer mistakes and should be fixed before runtime.
 * 
 * @public
 */
export class BusConfigError extends BusError {
  constructor(
    message: string,
    options?: ErrorOptions & { context?: BusErrorContext },
  ) {
    super(message, BusErrorCode.INVALID_CONFIG, options);
    this.name = 'BusConfigError';
  }
}