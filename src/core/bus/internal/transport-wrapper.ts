import { BusError, BusErrorCode } from '../bus-errors'

import type { Transport } from '@/contracts/transport'

/**
 * @internal
 */
export class TransportWrapper {
  readonly #transport: Transport

  constructor(transport: Transport) {
    this.#transport = transport
  }

  get name(): string {
    return this.#transport.name
  }

  async connect(): Promise<void> {
    try {
      await this.#transport.connect()
    } catch (error) {
      throw this.#createTransportError('connect', error as Error)
    }
  }

  async disconnect(): Promise<void> {
    try {
      await this.#transport.disconnect()
    } catch (error) {
      throw this.#createTransportError('disconnect', error as Error)
    }
  }

  async publish(channel: string, bytes: Uint8Array): Promise<void> {
    try {
      await this.#transport.publish(channel, bytes)
    } catch (error) {
      throw new BusError(
        `Failed to publish message to channel '${channel}': ${(error as Error).message}`,
        BusErrorCode.TRANSPORT_FAILED,
        {
          context: { operation: 'publish', channel, transport: this.name },
          cause: error as Error,
        },
      )
    }
  }

  async subscribe(channel: string, callback: (bytes: Uint8Array) => Promise<void>): Promise<void> {
    try {
      await this.#transport.subscribe(channel, callback)
    } catch (error) {
      throw new BusError(
        `Failed to subscribe to channel '${channel}': ${(error as Error).message}`,
        BusErrorCode.CHANNEL_ERROR,
        {
          context: { operation: 'subscribe', channel, transport: this.name },
          cause: error as Error,
        },
      )
    }
  }

  async unsubscribe(channel: string): Promise<void> {
    try {
      await this.#transport.unsubscribe(channel)
    } catch (error) {
      throw new BusError(
        `Failed to unsubscribe from channel '${channel}': ${(error as Error).message}`,
        BusErrorCode.CHANNEL_ERROR,
        {
          context: { operation: 'unsubscribe', channel, transport: this.name },
          cause: error as Error,
        },
      )
    }
  }

  #createTransportError(operation: string, error: Error): BusError {
    return new BusError(
      `Failed to ${operation} bus: ${error.message}`,
      BusErrorCode.TRANSPORT_FAILED,
      {
        context: { operation, transport: this.name },
        cause: error,
      },
    )
  }
}
