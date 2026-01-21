import {
  type Tracer,
  type Span,
  SpanStatusCode,
  type Attributes,
  context,
  trace,
} from '@opentelemetry/api'
import { CacheAttributes, CacheOperations } from './types.js'
import type { OpenTelemetryPluginConfig } from './types.js'

/**
 * Manages OpenTelemetry tracing for cache operations
 */
export class CacheTracing {
  private readonly tracer: Tracer
  private readonly config: Required<NonNullable<OpenTelemetryPluginConfig['tracing']>>

  constructor(
    tracer: Tracer,
    config: OpenTelemetryPluginConfig['tracing'] = {}
  ) {
    this.tracer = tracer
    this.config = {
      enableSpans: config.enableSpans ?? true,
      sampleRate: config.sampleRate ?? 1.0,
      captureStackTraces: config.captureStackTraces ?? true,
    }
  }

  /**
   * Start a cache operation span
   */
  startSpan(
    operation: string,
    attributes: Attributes
  ): Span {
    if (!this.config.enableSpans || !this.shouldSample()) {
      const activeSpan = trace.getSpan(context.active())
      if (activeSpan) {
        return activeSpan
      }
      return this.tracer.startSpan(operation, { attributes })
    }

    return this.tracer.startSpan(operation, {
      attributes,
    })
  }

  /**
   * Record a cache hit span
   */
  recordHit(attributes: {
    key: string
    store: string
    driver: string
    graced: boolean
  }): Span {
    const span = this.startSpan(CacheOperations.GET, {
      [CacheAttributes.KEY]: attributes.key,
      [CacheAttributes.STORE]: attributes.store,
      [CacheAttributes.DRIVER]: attributes.driver,
      [CacheAttributes.GRACED]: attributes.graced,
      [CacheAttributes.RESULT]: 'hit',
    })

    span.setStatus({ code: SpanStatusCode.OK })
    return span
  }

  /**
   * Record a cache miss span
   */
  recordMiss(attributes: { key: string; store: string }): Span {
    const span = this.startSpan(CacheOperations.GET, {
      [CacheAttributes.KEY]: attributes.key,
      [CacheAttributes.STORE]: attributes.store,
      [CacheAttributes.RESULT]: 'miss',
    })

    span.setStatus({ code: SpanStatusCode.OK })
    return span
  }

  /**
   * Record a set operation span
   */
  recordSet(attributes: {
    key: string
    store: string
    ttl?: number
    tags?: string[]
  }): Span {
    const spanAttributes: Attributes = {
      [CacheAttributes.KEY]: attributes.key,
      [CacheAttributes.STORE]: attributes.store,
    }

    if (attributes.ttl !== undefined) {
      spanAttributes[CacheAttributes.TTL] = attributes.ttl
    }

    if (attributes.tags) {
      spanAttributes[CacheAttributes.TAGS] = attributes.tags.join(',')
    }

    const span = this.startSpan(CacheOperations.SET, spanAttributes)
    span.setStatus({ code: SpanStatusCode.OK })
    return span
  }

  /**
   * Record a delete operation span
   */
  recordDelete(attributes: { key: string; store: string }): Span {
    const span = this.startSpan(CacheOperations.DELETE, {
      [CacheAttributes.KEY]: attributes.key,
      [CacheAttributes.STORE]: attributes.store,
    })

    span.setStatus({ code: SpanStatusCode.OK })
    return span
  }

  /**
   * Record a clear operation span
   */
  recordClear(attributes: { store: string }): Span {
    const span = this.startSpan(CacheOperations.CLEAR, {
      [CacheAttributes.STORE]: attributes.store,
    })

    span.setStatus({ code: SpanStatusCode.OK })
    return span
  }

  /**
   * Record an error span
   */
  recordError(attributes: {
    key: string
    store: string
    error: Error
    operation?: string
  }): Span {
    const span = this.startSpan(attributes.operation ?? 'cache.operation', {
      [CacheAttributes.KEY]: attributes.key,
      [CacheAttributes.STORE]: attributes.store,
      [CacheAttributes.ERROR_TYPE]: attributes.error.constructor.name,
      [CacheAttributes.ERROR_MESSAGE]: attributes.error.message,
    })

    span.recordException(attributes.error)

    span.setStatus({
      code: SpanStatusCode.ERROR,
      message: attributes.error.message,
    })

    return span
  }

  /**
   * Record a loader execution span
   */
  recordLoader(attributes: { key: string; store: string }): Span {
    const span = this.startSpan(CacheOperations.LOADER, {
      [CacheAttributes.KEY]: attributes.key,
      [CacheAttributes.STORE]: attributes.store,
    })

    return span
  }

  /**
   * Record an invalidate tags operation span
   */
  recordInvalidateTags(attributes: { tags: string[]; store: string }): Span {
    const span = this.startSpan(CacheOperations.INVALIDATE_TAGS, {
      [CacheAttributes.TAGS]: attributes.tags.join(','),
      [CacheAttributes.STORE]: attributes.store,
    })

    span.setStatus({ code: SpanStatusCode.OK })
    return span
  }

  /**
   * Determine if this operation should be sampled
   */
  private shouldSample(): boolean {
    return Math.random() < this.config.sampleRate
  }
}
