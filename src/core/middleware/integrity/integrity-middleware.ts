import { TransportMiddleware } from '../base'

import type { IntegrityConfig } from './integrity-config'

import type { Integrity } from '@/contracts/integrity'
import type { Transport } from '@/contracts/transport'
import type { TransportData, TransportMessageHandler } from '@/types'

import { createIntegrity } from '@/infrastructure/integrity'

/**
 * @internal
 */
export class IntegrityMiddleware extends TransportMiddleware {
  readonly #integrity: Integrity

  constructor(transport: Transport, config: IntegrityConfig) {
    super(transport)
    this.#integrity = createIntegrity(config.integrity)
  }

  override async publish(channel: string, data: TransportData): Promise<void> {
    const signed = this.#integrity.sign(data)

    await this.transport.publish(channel, signed)
  }

  override async subscribe(channel: string, handler: TransportMessageHandler): Promise<void> {
    return this.transport.subscribe(channel, (signedData: TransportData) => {
      const verified = this.#integrity.verify(signedData)

      handler(verified)
    })
  }
}
