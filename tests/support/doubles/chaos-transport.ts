/* eslint-disable @typescript-eslint/no-floating-promises */
import type { Transport } from '@/contracts/transport'
import type { TransportData, TransportMessageHandler } from '@/types'

/**
 * Chaos transport for fault injection testing.
 *
 * Simple API:
 * - failNext(n) - fail next N operations
 * - alwaysFail() - fail all operations
 * - neverFail() - disable failures
 * - recover() - reset and trigger reconnect
 */
export class ChaosTransport implements Transport {
  readonly name = 'chaos'

  private inner: Transport
  private shouldAlwaysFail = false
  private remainingFailures = 0
  private _failures = 0
  private onReconnectCallback?: () => void | Promise<void>
  private errorFactory: () => Error = () => new Error('Chaos failure')

  constructor(transport: Transport) {
    this.inner = transport
  }

  // ============ Chaos Control API ============

  /** Fail the next N operations */
  failNext(count: number): this {
    this.remainingFailures = count
    this._failures = 0
    return this
  }

  /** Fail all operations until recover() or neverFail() */
  alwaysFail(): this {
    this.shouldAlwaysFail = true
    return this
  }

  /** Stop failing operations */
  neverFail(): this {
    this.shouldAlwaysFail = false
    this.remainingFailures = 0
    return this
  }

  /** Reset failures and trigger reconnect callback */
  recover(): this {
    this.neverFail()
    this._failures = 0
    this.onReconnectCallback?.()
    return this
  }

  /** Set custom error factory */
  withError(factory: () => Error): this {
    this.errorFactory = factory
    return this
  }

  /** Number of failures that have occurred */
  get failures(): number {
    return this._failures
  }

  /** Reset failure counter */
  resetFailureCount(): void {
    this._failures = 0
  }

  // ============ Transport Interface ============

  async connect(): Promise<void> {
    this.maybeThrow()
    return this.inner.connect()
  }

  async disconnect(): Promise<void> {
    // Disconnect always succeeds
    return this.inner.disconnect()
  }

  async publish(channel: string, data: TransportData): Promise<void> {
    this.maybeThrow()
    return this.inner.publish(channel, data)
  }

  async subscribe(channel: string, handler: TransportMessageHandler): Promise<void> {
    this.maybeThrow()
    return this.inner.subscribe(channel, handler)
  }

  async unsubscribe(channel: string): Promise<void> {
    // Unsubscribe always succeeds
    return this.inner.unsubscribe(channel)
  }

  onReconnect(callback: () => void | Promise<void>): void {
    this.onReconnectCallback = callback
    this.inner.onReconnect(callback)
  }

  // ============ Internal ============

  private maybeThrow(): void {
    if (this.shouldAlwaysFail) {
      this._failures++
      throw this.errorFactory()
    }

    if (this.remainingFailures > 0) {
      this.remainingFailures--
      this._failures++
      throw this.errorFactory()
    }
  }
}
