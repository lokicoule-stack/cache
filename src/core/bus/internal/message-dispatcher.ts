import type { ChannelSubscription } from './channel-subscription'
import type { ErrorHandler } from './error-handler'
import type { Codec } from '@/contracts/codec'
import type { Serializable } from '@/types'

/**
 * @internal
 */
export class MessageDispatcher {
  readonly #codec: Codec
  readonly #errorHandler: ErrorHandler

  constructor(codec: Codec, errorHandler: ErrorHandler) {
    this.#codec = codec
    this.#errorHandler = errorHandler
  }

  async dispatch<T extends Serializable>(
    channel: string,
    bytes: Uint8Array,
    subscription: ChannelSubscription,
  ): Promise<void> {
    try {
      const data = this.#codec.decode<T>(bytes)

      if (subscription.handlerCount === 0) {
        return
      }

      const results = await subscription.notifyHandlers(data)

      this.#reportHandlerFailures(channel, results)
    } catch (error) {
      this.#errorHandler.handleError(channel, error as Error)
    }
  }

  #reportHandlerFailures(channel: string, results: PromiseSettledResult<void>[]): void {
    results.forEach((result) => {
      if (result.status === 'rejected') {
        const error =
          result.reason instanceof Error ? result.reason : new Error(String(result.reason))

        this.#errorHandler.handleError(channel, error)
      }
    })
  }
}
