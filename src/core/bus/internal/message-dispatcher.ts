import type { ChannelSubscription } from './channel-subscription'
import type { Codec } from '@/contracts/codec'
import type { Serializable, TransportData } from '@/types'

import debug from '@/debug'
import { CodecError } from '@/infrastructure/codecs/codec-errors'

export class MessageDispatcher {
  readonly #codec: Codec
  readonly #onHandlerError?: (channel: string, error: Error) => void

  constructor(codec: Codec, onHandlerError?: (channel: string, error: Error) => void) {
    this.#codec = codec
    this.#onHandlerError = onHandlerError
  }

  async dispatch<T extends Serializable>(
    channel: string,
    bytes: TransportData,
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
      if (error instanceof CodecError) {
        debug('[ERROR] Message decode failed:', {
          channel,
          codec: error.context?.codec,
          error: error.code,
        })
      }
      this.#handleError(channel, error as Error)
    }
  }

  #reportHandlerFailures(channel: string, results: PromiseSettledResult<void>[]): void {
    results.forEach((result) => {
      if (result.status === 'rejected') {
        const error =
          result.reason instanceof Error ? result.reason : new Error(String(result.reason))

        this.#handleError(channel, error)
      }
    })
  }

  #handleError(channel: string, error: Error): void {
    this.#onHandlerError?.(channel, error)
  }
}
