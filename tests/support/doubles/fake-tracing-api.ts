import { vi } from 'vitest'
import { SpanKind } from '@opentelemetry/api'
import type { Context, Span, SpanOptions } from '@opentelemetry/api'
import type { TracingApi } from '@/core/middleware/tracing/tracing-config'

export interface SpanRecord {
  name: string
  options: SpanOptions
  ended: boolean
  attributes: Record<string, unknown>
  status?: { code: number; message?: string }
  exception?: Error
}

/**
 * Test double for OpenTelemetry TracingApi.
 *
 * Provides inspection methods for verifying tracing behavior:
 * - Track created spans with their options and lifecycle
 * - Inspect injected/extracted trace context carriers
 * - Verify span attributes and status
 */
export class FakeTracingApi implements TracingApi {
  readonly spans: SpanRecord[] = []
  readonly injectedCarriers: Array<Record<string, string>> = []
  readonly extractedCarriers: Array<Record<string, string>> = []

  private readonly mockContext = {} as Context
  private readonly traceId: string
  private readonly spanId: string

  constructor(options: { traceId?: string; spanId?: string } = {}) {
    this.traceId = options.traceId ?? 'test-trace-id'
    this.spanId = options.spanId ?? 'test-span-id'
  }

  // ============ TracingApi Implementation ============

  getActiveContext(): Context {
    return this.mockContext
  }

  withContext<T>(_ctx: Context, fn: () => T): T {
    return fn()
  }

  inject(_context: Context, carrier: Record<string, string>): void {
    carrier['traceparent'] = `00-${this.traceId}-${this.spanId}-01`
    this.injectedCarriers.push({ ...carrier })
  }

  extract(_context: Context, carrier: Record<string, string>): Context {
    this.extractedCarriers.push({ ...carrier })
    return this.mockContext
  }

  startSpan(name: string, options?: SpanOptions): Span {
    return this.createMockSpan(name, options ?? {})
  }

  startActiveSpan<T>(
    name: string,
    options: SpanOptions,
    _context: Context,
    fn: (span: Span) => T,
  ): T {
    const span = this.createMockSpan(name, options)
    return fn(span)
  }

  // ============ Test Helpers ============

  /** Get spans by kind (PRODUCER, CONSUMER, etc.) */
  getSpansByKind(kind: SpanKind): SpanRecord[] {
    return this.spans.filter((s) => s.options.kind === kind)
  }

  /** Get the last created span */
  getLastSpan(): SpanRecord | undefined {
    return this.spans[this.spans.length - 1]
  }

  /** Get producer spans */
  getProducerSpans(): SpanRecord[] {
    return this.getSpansByKind(SpanKind.PRODUCER)
  }

  /** Get consumer spans */
  getConsumerSpans(): SpanRecord[] {
    return this.getSpansByKind(SpanKind.CONSUMER)
  }

  /** Check if all spans have been ended */
  allSpansEnded(): boolean {
    return this.spans.every((s) => s.ended)
  }

  /** Reset all state */
  reset(): void {
    this.spans.length = 0
    this.injectedCarriers.length = 0
    this.extractedCarriers.length = 0
  }

  // ============ Internal ============

  private createMockSpan(name: string, options: SpanOptions): Span {
    const record: SpanRecord = {
      name,
      options,
      ended: false,
      attributes: {},
    }
    this.spans.push(record)

    return {
      setAttribute: vi.fn((key: string, value: unknown) => {
        record.attributes[key] = value
      }),
      setAttributes: vi.fn((attrs: Record<string, unknown>) => {
        Object.assign(record.attributes, attrs)
      }),
      setStatus: vi.fn((status: { code: number; message?: string }) => {
        record.status = status
      }),
      recordException: vi.fn((error: Error) => {
        record.exception = error
      }),
      end: vi.fn(() => {
        record.ended = true
      }),
      isRecording: () => true,
      spanContext: () => ({
        traceId: this.traceId,
        spanId: this.spanId,
        traceFlags: 1,
      }),
      updateName: vi.fn(),
      addEvent: vi.fn(),
      addLink: vi.fn(),
      addLinks: vi.fn(),
    } as unknown as Span
  }
}
