import { context, propagation, SpanKind, SpanStatusCode } from '@opentelemetry/api'

import { TransportMiddleware } from '../base'

import type { TracingConfig, ResolvedTracingConfig } from './tracing-config'
import type { Span, Tracer } from '@opentelemetry/api'
import type { Transport } from '@/contracts/transport'
import type { TransportData, TransportMessageHandler } from '@/types'

import { isTracingApi, resolveTracingConfig } from './tracing-config'

/**
 * Message envelope that wraps payload with trace context.
 *
 * @internal
 */
interface TracedEnvelope {
  /** Original payload as array (Uint8Array serialized) */
  p: number[]
  /** Trace context carrier (W3C TraceContext headers) */
  t: Record<string, string>
}

/**
 * Magic byte prefix to identify traced messages.
 * Using 0x54 0x52 ('TR' for TRace) to distinguish from regular payloads.
 *
 * @internal
 */
const TRACE_MAGIC = new Uint8Array([0x54, 0x52])

/**
 * OpenTelemetry semantic conventions for messaging systems.
 *
 * @see https://opentelemetry.io/docs/specs/semconv/messaging/
 * @internal
 */
const MessagingAttributes = {
  SYSTEM: 'messaging.system',
  DESTINATION: 'messaging.destination.name',
  OPERATION: 'messaging.operation.type',
  MESSAGE_PAYLOAD_SIZE: 'messaging.message.body.size',
  CLIENT_ID: 'messaging.client_id',
} as const

/**
 * Tracing middleware that propagates OpenTelemetry context across message boundaries.
 *
 * @remarks
 * This middleware wraps messages in an envelope containing the trace context,
 * enabling distributed tracing across publish/subscribe boundaries.
 *
 * The envelope format is:
 * - Magic bytes (0x54 0x52) to identify traced messages
 * - JSON-encoded envelope with payload and trace context
 *
 * @example
 * ```typescript
 * import { trace } from '@opentelemetry/api'
 *
 * const tracer = trace.getTracer('my-service')
 * const middleware = new TracingMiddleware(transport, { tracer })
 * ```
 *
 * @public
 */
export class TracingMiddleware extends TransportMiddleware {
  readonly #config: ResolvedTracingConfig
  readonly #encoder: InstanceType<typeof TextEncoder>
  readonly #decoder: InstanceType<typeof TextDecoder>

  constructor(transport: Transport, config: TracingConfig) {
    super(transport)
    this.#config = resolveTracingConfig(config)
    this.#encoder = new TextEncoder()
    this.#decoder = new TextDecoder()
  }

  override get name(): string {
    return `tracing(${this.transport.name})`
  }

  override async publish(channel: string, data: TransportData): Promise<void> {
    const spanName = `${channel} publish`

    await this.#withSpan(
      spanName,
      { kind: SpanKind.PRODUCER },
      async (span) => {
        // Set messaging attributes
        span.setAttributes({
          [MessagingAttributes.SYSTEM]: this.#getTransportSystem(),
          [MessagingAttributes.DESTINATION]: channel,
          [MessagingAttributes.OPERATION]: 'publish',
        })

        if (this.#config.recordPayloadSize) {
          span.setAttribute(MessagingAttributes.MESSAGE_PAYLOAD_SIZE, data.length)
        }

        try {
          // Inject trace context into carrier
          const carrier: Record<string, string> = {}
          this.#injectContext(carrier)

          // Create traced envelope
          const envelope: TracedEnvelope = {
            p: Array.from(data),
            t: carrier,
          }

          // Encode envelope with magic prefix
          const envelopeBytes = this.#encodeEnvelope(envelope)

          await this.transport.publish(channel, envelopeBytes)

          span.setStatus({ code: SpanStatusCode.OK })
        } catch (error) {
          span.setStatus({ code: SpanStatusCode.ERROR, message: String(error) })
          span.recordException(error as Error)
          throw error
        }
      },
    )
  }

  override async subscribe(channel: string, handler: TransportMessageHandler): Promise<void> {
    return this.transport.subscribe(channel, async (data: TransportData) => {
      // Check if message has trace context (magic prefix)
      if (!this.#isTracedMessage(data)) {
        // Non-traced message, pass through directly
        await handler(data)
        return
      }

      // Decode envelope
      const envelope = this.#decodeEnvelope(data)
      if (!envelope) {
        // Failed to decode, pass original data
        await handler(data)
        return
      }

      // Extract parent context
      const parentContext = this.#extractContext(envelope.t)

      // Create consumer span within parent context
      const spanName = `${channel} process`

      await this.#withSpanInContext(
        spanName,
        { kind: SpanKind.CONSUMER },
        parentContext,
        async (span) => {
          span.setAttributes({
            [MessagingAttributes.SYSTEM]: this.#getTransportSystem(),
            [MessagingAttributes.DESTINATION]: channel,
            [MessagingAttributes.OPERATION]: 'process',
          })

          if (this.#config.recordPayloadSize) {
            span.setAttribute(MessagingAttributes.MESSAGE_PAYLOAD_SIZE, envelope.p.length)
          }

          try {
            // Reconstruct original payload
            const originalData = new Uint8Array(envelope.p)
            await handler(originalData)

            span.setStatus({ code: SpanStatusCode.OK })
          } catch (error) {
            span.setStatus({ code: SpanStatusCode.ERROR, message: String(error) })
            span.recordException(error as Error)
            throw error
          }
        },
      )
    })
  }

  /**
   * Execute callback within a new span.
   */
  async #withSpan<T>(
    name: string,
    options: { kind: SpanKind },
    fn: (span: Span) => Promise<T>,
  ): Promise<T> {
    const tracer = this.#config.tracer

    if (isTracingApi(tracer)) {
      const ctx = tracer.getActiveContext()
      return tracer.startActiveSpan(name, options, ctx, async (span) => {
        try {
          return await fn(span)
        } finally {
          span.end()
        }
      })
    }

    // Standard OpenTelemetry Tracer
    return (tracer as Tracer).startActiveSpan(name, options, async (span) => {
      try {
        return await fn(span)
      } finally {
        span.end()
      }
    })
  }

  /**
   * Execute callback within a new span in a specific context.
   */
  async #withSpanInContext<T>(
    name: string,
    options: { kind: SpanKind },
    parentContext: ReturnType<typeof context.active>,
    fn: (span: Span) => Promise<T>,
  ): Promise<T> {
    const tracer = this.#config.tracer

    if (isTracingApi(tracer)) {
      return tracer.withContext(parentContext, async () => {
        return tracer.startActiveSpan(name, options, parentContext, async (span) => {
          try {
            return await fn(span)
          } finally {
            span.end()
          }
        })
      })
    }

    // Standard OpenTelemetry Tracer - use context.with
    return context.with(parentContext, async () => {
      return (tracer as Tracer).startActiveSpan(name, options, parentContext, async (span) => {
        try {
          return await fn(span)
        } finally {
          span.end()
        }
      })
    })
  }

  /**
   * Inject current trace context into carrier.
   */
  #injectContext(carrier: Record<string, string>): void {
    const tracer = this.#config.tracer

    if (isTracingApi(tracer)) {
      const ctx = tracer.getActiveContext()
      tracer.inject(ctx, carrier)
    } else {
      // Use standard propagation API
      propagation.inject(context.active(), carrier, this.#config.textMapSetter)
    }
  }

  /**
   * Extract trace context from carrier.
   */
  #extractContext(carrier: Record<string, string>): ReturnType<typeof context.active> {
    const tracer = this.#config.tracer

    if (isTracingApi(tracer)) {
      return tracer.extract(tracer.getActiveContext(), carrier)
    }

    // Use standard propagation API
    return propagation.extract(context.active(), carrier, this.#config.textMapGetter)
  }

  /**
   * Check if message has trace magic prefix.
   */
  #isTracedMessage(data: TransportData): boolean {
    if (data.length < TRACE_MAGIC.length + 1) {
      return false
    }

    return data[0] === TRACE_MAGIC[0] && data[1] === TRACE_MAGIC[1]
  }

  /**
   * Encode envelope with magic prefix.
   */
  #encodeEnvelope(envelope: TracedEnvelope): Uint8Array {
    const json = JSON.stringify(envelope)
    const jsonBytes = this.#encoder.encode(json)

    const result = new Uint8Array(TRACE_MAGIC.length + jsonBytes.length)
    result.set(TRACE_MAGIC, 0)
    result.set(jsonBytes, TRACE_MAGIC.length)

    return result
  }

  /**
   * Decode envelope from bytes.
   */
  #decodeEnvelope(data: TransportData): TracedEnvelope | null {
    try {
      const jsonBytes = data.slice(TRACE_MAGIC.length)
      const json = this.#decoder.decode(jsonBytes)
      return JSON.parse(json) as TracedEnvelope
    } catch {
      return null
    }
  }

  /**
   * Get transport system identifier for semantic conventions.
   */
  #getTransportSystem(): string {
    const name = this.transport.name.toLowerCase()

    if (name.includes('redis')) return 'redis'
    if (name.includes('memory')) return 'memory'
    if (name.includes('kafka')) return 'kafka'
    if (name.includes('rabbitmq')) return 'rabbitmq'
    if (name.includes('nats')) return 'nats'

    return name
  }
}
