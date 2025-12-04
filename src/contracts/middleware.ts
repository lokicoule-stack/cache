import type { Transport } from '@/contracts/transport'

export interface Middleware extends Transport {

  readonly transport: Transport
}
