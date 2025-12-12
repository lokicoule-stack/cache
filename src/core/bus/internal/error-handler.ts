import { BusError, BusErrorCode } from '../bus-errors'

/**
 * @internal
 */
export class ErrorHandler {
  readonly #onHandlerError?: (channel: string, error: Error) => void

  constructor(onHandlerError?: (channel: string, error: Error) => void) {
    this.#onHandlerError = onHandlerError
  }

  handleError(channel: string, error: Error): void {
    const busError = new BusError(
      `Handler failed for channel '${channel}': ${error.message}`,
      BusErrorCode.HANDLER_FAILED,
      {
        context: { operation: 'handle', channel },
        cause: error,
      },
    )

    console.error('[MessageBus] Handler error:', {
      channel,
      error: busError.message,
      cause: error,
    })

    this.#onHandlerError?.(channel, busError)
  }
}
