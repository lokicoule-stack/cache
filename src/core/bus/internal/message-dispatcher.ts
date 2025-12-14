import type { ChannelSubscription } from './channel-subscription'
import type { HandlerExecutionEvent } from '@/contracts/bus'
import type { Codec } from '@/contracts/codec'
import type { Serializable, TransportData } from '@/types'

import debug from '@/debug'
import { CodecError } from '@/infrastructure/codecs/codec-errors'

export class MessageDispatcher {
  readonly #codec: Codec
  readonly #onHandlerError?: (channel: string, error: Error) => void
  readonly #onHandlerExecution?: (event: HandlerExecutionEvent) => void

  constructor(
    codec: Codec,
    onHandlerError?: (channel: string, error: Error) => void,
    onHandlerExecution?: (event: HandlerExecutionEvent) => void,
  ) {
    this.#codec = codec
    this.#onHandlerError = onHandlerError
    this.#onHandlerExecution = onHandlerExecution
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

      const startTime = performance.now()
      const results = await subscription.notifyHandlers(data)
      const duration = performance.now() - startTime

      this.#reportHandlerFailures(channel, results, duration)
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

  #reportHandlerFailures(
    channel: string,
    results: PromiseSettledResult<void>[],
    totalDuration: number,
  ): void {
    const handlerDuration = results.length > 0 ? totalDuration / results.length : 0

    results.forEach((result) => {
      if (result.status === 'rejected') {
        const error =
          result.reason instanceof Error ? result.reason : new Error(String(result.reason))

        this.#handleError(channel, error)

        this.#onHandlerExecution?.({
          channel,
          duration: handlerDuration,
          success: false,
          error,
          timestamp: Date.now(),
        })
      } else {
        this.#onHandlerExecution?.({
          channel,
          duration: handlerDuration,
          success: true,
          timestamp: Date.now(),
        })
      }
    })
  }

  #handleError(channel: string, error: Error): void {
    this.#onHandlerError?.(channel, error)
  }
}
