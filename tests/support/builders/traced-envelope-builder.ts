import { TransportData } from '@/types'

/**
 * Builder for creating traced message envelopes in tests.
 *
 * Traced envelopes have the format:
 * - 2 bytes magic header: 0x54 0x52 ('TR')
 * - JSON envelope: { p: payload, t: trace context }
 */
export class TracedEnvelopeBuilder {
  private payload: number[] = [1, 2, 3]
  private traceContext: Record<string, string> = {
    traceparent: '00-test-trace-id-test-span-id-01',
  }

  static create(): TracedEnvelopeBuilder {
    return new TracedEnvelopeBuilder()
  }

  static valid(): TransportData {
    return new TracedEnvelopeBuilder().build()
  }

  static malformed(): TransportData {
    return new Uint8Array([0x54, 0x52, 0xff, 0xff])
  }

  static untraced(data: number[] = [10, 20, 30]): TransportData {
    return new Uint8Array(data)
  }

  withPayload(data: number[] | TransportData): this {
    this.payload = Array.from(data)
    return this
  }

  withTraceParent(traceparent: string): this {
    this.traceContext.traceparent = traceparent
    return this
  }

  withTraceContext(context: Record<string, string>): this {
    this.traceContext = context
    return this
  }

  build(): TransportData {
    const envelope = {
      p: this.payload,
      t: this.traceContext,
    }
    const envelopeBytes = new TextEncoder().encode(JSON.stringify(envelope))
    const result = new Uint8Array(2 + envelopeBytes.length)
    result[0] = 0x54 // 'T'
    result[1] = 0x52 // 'R'
    result.set(envelopeBytes, 2)
    return result
  }

  buildEnvelope(): { p: number[]; t: Record<string, string> } {
    return {
      p: this.payload,
      t: this.traceContext,
    }
  }
}

/** Magic bytes for traced envelopes */
export const TRACING_MAGIC = {
  T: 0x54,
  R: 0x52,
} as const
