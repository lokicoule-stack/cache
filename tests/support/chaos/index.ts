/**
 * Chaos engineering for message bus - FAANG grade
 * 
 * Philosophy:
 * - Test realistic failure modes
 * - Verify graceful degradation
 * - Ensure system resilience
 * 
 * Organized by:
 * 1. Strategies (how to inject chaos)
 * 2. Scenarios (pre-built test cases)
 * 3. Decorators (apply chaos to existing tests)
 */

import type { Transport, TransportMessageHandler } from '@/contracts/transport'
import type { TransportData } from '@/types'

/**
 * Chaos configuration
 */
export interface ChaosConfig {
  // Network issues
  latency?: {
    baseMs: number
    varianceMs: number
  }

  // Failures
  failures?: {
    rate: number // 0-1
    operations?: Array<'connect' | 'disconnect' | 'publish' | 'subscribe'>
  }

  // Disconnections
  disconnects?: {
    probability: number // 0-1
    onOperation?: 'publish' | 'subscribe'
  }

  // Message issues
  messages?: {
    dropRate?: number // 0-1
    duplicateRate?: number // 0-1
    reorderRate?: number // 0-1
  }
}

/**
 * Chaos transport wrapper
 */
export class ChaosTransport implements Transport {
  readonly name = 'chaos'

  private messageQueue: Array<{
    channel: string
    data: TransportData
    handler: TransportMessageHandler
    scheduledAt: number
  }> = []

  constructor(
    private readonly transport: Transport,
    private readonly config: ChaosConfig,
  ) {}

  async connect(): Promise<void> {
    await this.injectLatency()
    await this.injectFailure('connect')
    return this.transport.connect()
  }

  async disconnect(): Promise<void> {
    await this.injectLatency()
    await this.injectFailure('disconnect')
    return this.transport.disconnect()
  }

  async publish(channel: string, data: TransportData): Promise<void> {
    await this.injectLatency()
    await this.injectFailure('publish')
    await this.injectDisconnect('publish')

    // Message drop
    if (this.shouldDropMessage()) {
      return // Silently drop
    }

    // Message duplication
    const duplicates = this.shouldDuplicateMessage() ? 2 : 1

    for (let i = 0; i < duplicates; i++) {
      await this.transport.publish(channel, data)
    }
  }

  async subscribe(channel: string, handler: TransportMessageHandler): Promise<void> {
    await this.injectLatency()
    await this.injectFailure('subscribe')
    await this.injectDisconnect('subscribe')

    // Wrap handler to inject message-level chaos
    const chaosHandler: TransportMessageHandler = (data) => {
      if (this.shouldReorderMessage()) {
        // Delay this message randomly
        const delay = Math.random() * 100
        setTimeout(() => handler(data), delay)
      } else {
        handler(data)
      }
    }

    return this.transport.subscribe(channel, chaosHandler)
  }

  async unsubscribe(channel: string): Promise<void> {
    await this.injectLatency()
    return this.transport.unsubscribe(channel)
  }

  private async injectLatency(): Promise<void> {
    if (!this.config.latency) return

    const { baseMs, varianceMs } = this.config.latency
    const actualLatency = baseMs + (Math.random() * 2 - 1) * varianceMs

    if (actualLatency > 0) {
      await new Promise((resolve) => setTimeout(resolve, actualLatency))
    }
  }

  private async injectFailure(operation: string): Promise<void> {
    if (!this.config.failures) return

    const { rate, operations } = this.config.failures

    if (operations && !operations.includes(operation as any)) {
      return
    }

    if (Math.random() < rate) {
      throw new Error(`Chaos: ${operation} failed`)
    }
  }

  private async injectDisconnect(operation?: string): Promise<void> {
    if (!this.config.disconnects) return

    const { probability, onOperation } = this.config.disconnects

    if (onOperation && onOperation !== operation) {
      return
    }

    if (Math.random() < probability) {
      await this.transport.disconnect()
      throw new Error('Chaos: unexpected disconnect')
    }
  }

  private shouldDropMessage(): boolean {
    return Math.random() < (this.config.messages?.dropRate ?? 0)
  }

  private shouldDuplicateMessage(): boolean {
    return Math.random() < (this.config.messages?.duplicateRate ?? 0)
  }

  private shouldReorderMessage(): boolean {
    return Math.random() < (this.config.messages?.reorderRate ?? 0)
  }
}

/**
 * Pre-defined chaos strategies
 */
export const chaosStrategies = {
  /**
   * Mild chaos - occasional issues
   */
  mild: (transport: Transport): ChaosTransport =>
    new ChaosTransport(transport, {
      latency: { baseMs: 10, varianceMs: 20 },
      failures: { rate: 0.05 },
      messages: { dropRate: 0.01 },
    }),

  /**
   * Moderate chaos - regular issues
   */
  moderate: (transport: Transport): ChaosTransport =>
    new ChaosTransport(transport, {
      latency: { baseMs: 50, varianceMs: 100 },
      failures: { rate: 0.15 },
      disconnects: { probability: 0.02 },
      messages: { dropRate: 0.05, duplicateRate: 0.02 },
    }),

  /**
   * Severe chaos - frequent failures
   */
  severe: (transport: Transport): ChaosTransport =>
    new ChaosTransport(transport, {
      latency: { baseMs: 100, varianceMs: 200 },
      failures: { rate: 0.3 },
      disconnects: { probability: 0.1 },
      messages: { dropRate: 0.15, duplicateRate: 0.05, reorderRate: 0.1 },
    }),

  /**
   * Network partition - high latency, disconnects
   */
  partition: (transport: Transport): ChaosTransport =>
    new ChaosTransport(transport, {
      latency: { baseMs: 500, varianceMs: 500 },
      disconnects: { probability: 0.3 },
      messages: { dropRate: 0.5 },
    }),

  /**
   * Flaky connection - random disconnects
   */
  flaky: (transport: Transport): ChaosTransport =>
    new ChaosTransport(transport, {
      disconnects: { probability: 0.2 },
      failures: { rate: 0.1, operations: ['connect', 'disconnect'] },
    }),

  /**
   * Lossy network - drops and duplicates messages
   */
  lossy: (transport: Transport): ChaosTransport =>
    new ChaosTransport(transport, {
      messages: {
        dropRate: 0.2,
        duplicateRate: 0.1,
        reorderRate: 0.15,
      },
    }),
}

/**
 * Chaos scenarios - complete test scenarios
 */
export const chaosScenarios = {
  /**
   * Gradual degradation over time
   */
  gradualDegradation: async (
    transport: Transport,
    test: (t: Transport) => Promise<void>,
    durationMs: number = 5000,
  ): Promise<void> => {
    const config: ChaosConfig = {
      latency: { baseMs: 0, varianceMs: 0 },
      failures: { rate: 0 },
    }

    const chaosTransport = new ChaosTransport(transport, config)
    const startTime = Date.now()

    // Gradually increase chaos
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime
      const progress = Math.min(elapsed / durationMs, 1)

      config.latency!.baseMs = progress * 500
      config.failures!.rate = progress * 0.5
    }, 100)

    try {
      await test(chaosTransport)
    } finally {
      clearInterval(interval)
    }
  },

  /**
   * Cascading failures - one failure triggers more
   */
  cascadingFailures: async (
    operations: Array<() => Promise<void>>,
    config: {
      initialFailureRate?: number
      escalationFactor?: number
    } = {},
  ): Promise<{
    succeeded: number
    failed: number
    results: Array<{ success: boolean; error?: Error }>
  }> => {
    const { initialFailureRate = 0.1, escalationFactor = 1.5 } = config

    let currentRate = initialFailureRate
    let succeeded = 0
    let failed = 0
    const results: Array<{ success: boolean; error?: Error }> = []

    for (const operation of operations) {
      try {
        if (Math.random() < currentRate) {
          throw new Error('Cascading failure')
        }

        await operation()
        results.push({ success: true })
        succeeded++

        // Success reduces failure rate
        currentRate = Math.max(initialFailureRate, currentRate * 0.9)
      } catch (error) {
        results.push({ success: false, error: error as Error })
        failed++

        // Failure increases rate (cascade effect)
        currentRate = Math.min(0.95, currentRate * escalationFactor)
      }
    }

    return { succeeded, failed, results }
  },

  /**
   * Thundering herd - burst of concurrent operations
   */
  thunderingHerd: async <T>(
    operation: () => Promise<T>,
    count: number,
  ): Promise<{
    succeeded: number
    failed: number
    results: Array<{ success: boolean; result?: T; error?: Error; durationMs: number }>
  }> => {
    const startTime = Date.now()

    const promises = Array.from({ length: count }, async () => {
      const opStart = Date.now()
      try {
        const result = await operation()
        return {
          success: true,
          result,
          durationMs: Date.now() - opStart,
        }
      } catch (error) {
        return {
          success: false,
          error: error as Error,
          durationMs: Date.now() - opStart,
        }
      }
    })

    const results = await Promise.all(promises)
    const succeeded = results.filter((r) => r.success).length
    const failed = results.filter((r) => !r.success).length

    return { succeeded, failed, results }
  },

  /**
   * Recovery test - verify system recovers after chaos
   */
  recovery: async (
    transport: Transport,
    setup: (t: Transport) => Promise<void>,
    chaos: (t: Transport) => Promise<void>,
    verify: (t: Transport) => Promise<void>,
  ): Promise<{
    setupSucceeded: boolean
    chaosCompleted: boolean
    recoverySucceeded: boolean
    errors: Error[]
  }> => {
    const errors: Error[] = []
    let setupSucceeded = false
    let chaosCompleted = false
    let recoverySucceeded = false

    try {
      await setup(transport)
      setupSucceeded = true
    } catch (error) {
      errors.push(error as Error)
    }

    try {
      await chaos(transport)
      chaosCompleted = true
    } catch (error) {
      errors.push(error as Error)
    }

    // Wait a bit for recovery
    await new Promise((resolve) => setTimeout(resolve, 100))

    try {
      await verify(transport)
      recoverySucceeded = true
    } catch (error) {
      errors.push(error as Error)
    }

    return {
      setupSucceeded,
      chaosCompleted,
      recoverySucceeded,
      errors,
    }
  },
}

/**
 * Chaos test decorator - apply chaos to existing test
 */
export function withChaos(
  strategy: keyof typeof chaosStrategies,
): (transport: Transport) => Transport {
  return (transport: Transport) => {
    return chaosStrategies[strategy](transport)
  }
}

/**
 * Resource chaos utilities
 */
export const resourceChaos = {
  /**
   * Simulate memory pressure
   */
  memoryPressure: (sizeMB: number = 100): (() => void) => {
    const arrays: number[][] = []

    for (let i = 0; i < sizeMB; i++) {
      arrays.push(new Array(1024 * 256).fill(0))
    }

    return () => {
      arrays.length = 0
    }
  },

  /**
   * Simulate CPU load
   */
  cpuLoad: async (durationMs: number = 100): Promise<void> => {
    const start = Date.now()
    while (Date.now() - start < durationMs) {
      Math.sqrt(Math.random() * 1000000)
    }
  },

  /**
   * Execute burst of operations
   */
  burst: async <T>(
    operation: () => Promise<T>,
    count: number,
    concurrency: number = 10,
  ): Promise<T[]> => {
    const results: T[] = []

    for (let i = 0; i < count; i += concurrency) {
      const batch = Array.from(
        { length: Math.min(concurrency, count - i) },
        () => operation(),
      )
      const batchResults = await Promise.all(batch)
      results.push(...batchResults)
    }

    return results
  },
}
