/**
 * @public
 */
export const BusErrorCode = {
  BUS_ERROR: 'BUS_ERROR',
  INVALID_CONFIG: 'INVALID_CONFIG',
} as const

/**
 * @public
 */
export type BusErrorCode = (typeof BusErrorCode)[keyof typeof BusErrorCode]

/**
 * @public
 */
export interface BusErrorContext {
  /** Additional non-sensitive metadata */
  [key: string]: unknown
}

/**
 * @public
 */
export class BusError extends Error {
  /** Machine-readable error code */
  readonly code: BusErrorCode

  /** Additional error context */
  readonly context?: BusErrorContext

  constructor(
    message: string,
    code: BusErrorCode = BusErrorCode.BUS_ERROR,
    options?: ErrorOptions & { context?: BusErrorContext },
  ) {
    super(message, options)

    this.name = 'BusError'
    this.code = code
    this.context = options?.context

    Error.captureStackTrace?.(this, this.constructor)
  }

  /** @internal */
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      context: this.context,
      stack: this.stack,
    }
  }
}

/**
 * Configuration error for message bus.
 *
 * @remarks
 * Thrown during bus initialization when configuration is invalid.
 *
 * @public
 */
export class BusConfigError extends BusError {
  constructor(message: string, options?: ErrorOptions & { context?: BusErrorContext }) {
    super(message, BusErrorCode.INVALID_CONFIG, options)
    this.name = 'BusConfigError'
  }
}
