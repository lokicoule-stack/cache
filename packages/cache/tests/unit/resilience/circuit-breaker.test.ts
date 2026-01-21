import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

import { createCircuitBreaker } from '@/resilience/circuit-breaker'
import { advanceTime, freezeTime } from '../../support/time'

describe('createCircuitBreaker', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })


  describe('initial state', () => {
    it('starts in closed state', () => {
      const cb = createCircuitBreaker({ breakDuration: 30_000 })

      expect(cb.isOpen()).toBe(false)
    })
  })


  describe('failure threshold', () => {
    it('opens after single failure with default threshold', () => {
      const cb = createCircuitBreaker({ breakDuration: 30_000 })

      cb.recordFailure()

      expect(cb.isOpen()).toBe(true)
    })

    it('opens after reaching custom threshold', () => {
      const cb = createCircuitBreaker({ breakDuration: 30_000, failureThreshold: 3 })

      cb.recordFailure()
      expect(cb.isOpen()).toBe(false)

      cb.recordFailure()
      expect(cb.isOpen()).toBe(false)

      cb.recordFailure()
      expect(cb.isOpen()).toBe(true)
    })

    it('stays closed below threshold', () => {
      const cb = createCircuitBreaker({ breakDuration: 30_000, failureThreshold: 5 })

      for (let i = 0; i < 4; i++) {
        cb.recordFailure()
      }

      expect(cb.isOpen()).toBe(false)
    })
  })


  describe('success recording', () => {
    it('resets failure count on success', () => {
      const cb = createCircuitBreaker({ breakDuration: 30_000, failureThreshold: 3 })

      cb.recordFailure()
      cb.recordFailure()
      cb.recordSuccess() // Resets counter

      cb.recordFailure()
      cb.recordFailure()

      expect(cb.isOpen()).toBe(false) // Still below threshold
    })

    it('keeps circuit closed after success', () => {
      const cb = createCircuitBreaker({ breakDuration: 30_000 })

      cb.recordSuccess()
      cb.recordSuccess()
      cb.recordSuccess()

      expect(cb.isOpen()).toBe(false)
    })
  })


  describe('break duration', () => {
    it('stays open for break duration', () => {
      freezeTime()
      const cb = createCircuitBreaker({ breakDuration: 30_000 })

      cb.recordFailure()

      advanceTime(15_000) // Half way

      expect(cb.isOpen()).toBe(true)
    })

    it('closes after break duration', () => {
      freezeTime()
      const cb = createCircuitBreaker({ breakDuration: 30_000 })

      cb.recordFailure()

      advanceTime(30_000)

      expect(cb.isOpen()).toBe(false)
    })

    it('resets failure count after duration', () => {
      freezeTime()
      const cb = createCircuitBreaker({ breakDuration: 30_000, failureThreshold: 3 })

      // Open the circuit
      cb.recordFailure()
      cb.recordFailure()
      cb.recordFailure()
      expect(cb.isOpen()).toBe(true)

      // Wait for reset
      advanceTime(30_000)
      expect(cb.isOpen()).toBe(false)

      // Need full threshold again to reopen
      cb.recordFailure()
      cb.recordFailure()
      expect(cb.isOpen()).toBe(false)
    })

    it('handles very short break duration', () => {
      freezeTime()
      const cb = createCircuitBreaker({ breakDuration: 1 })

      cb.recordFailure()
      expect(cb.isOpen()).toBe(true)

      advanceTime(2)

      expect(cb.isOpen()).toBe(false)
    })

    it('handles very long break duration', () => {
      freezeTime()
      const cb = createCircuitBreaker({ breakDuration: 1_000_000 })

      cb.recordFailure()

      advanceTime(500_000)

      expect(cb.isOpen()).toBe(true)
    })
  })


  describe('reset()', () => {
    it('closes open circuit immediately', () => {
      const cb = createCircuitBreaker({ breakDuration: 30_000 })

      cb.recordFailure()
      expect(cb.isOpen()).toBe(true)

      cb.reset()

      expect(cb.isOpen()).toBe(false)
    })

    it('resets failure counter', () => {
      const cb = createCircuitBreaker({ breakDuration: 30_000, failureThreshold: 3 })

      cb.recordFailure()
      cb.recordFailure()
      cb.reset()

      cb.recordFailure()
      cb.recordFailure()

      expect(cb.isOpen()).toBe(false)
    })

    it('can be called multiple times', () => {
      const cb = createCircuitBreaker({ breakDuration: 30_000 })

      cb.recordFailure()
      cb.reset()
      cb.reset()
      cb.reset()

      expect(cb.isOpen()).toBe(false)
    })

    it('allows circuit to reopen after reset', () => {
      const cb = createCircuitBreaker({ breakDuration: 30_000 })

      cb.recordFailure()
      cb.reset()

      cb.recordFailure()

      expect(cb.isOpen()).toBe(true)
    })
  })


  describe('state transitions', () => {
    it('transitions: closed -> open -> closed', () => {
      freezeTime()
      const cb = createCircuitBreaker({ breakDuration: 30_000 })

      expect(cb.isOpen()).toBe(false) // Closed

      cb.recordFailure()
      expect(cb.isOpen()).toBe(true) // Open

      advanceTime(30_000)
      expect(cb.isOpen()).toBe(false) // Closed again
    })

    it('can reopen after closing', () => {
      freezeTime()
      const cb = createCircuitBreaker({ breakDuration: 30_000 })

      cb.recordFailure() // Open
      advanceTime(30_000) // Close

      cb.recordFailure() // Open again

      expect(cb.isOpen()).toBe(true)
    })

    it('handles rapid state changes', () => {
      freezeTime()
      const cb = createCircuitBreaker({ breakDuration: 10 })

      for (let i = 0; i < 5; i++) {
        cb.recordFailure()
        expect(cb.isOpen()).toBe(true)

        advanceTime(10)
        expect(cb.isOpen()).toBe(false)
      }
    })
  })


  describe('edge cases', () => {
    it('handles zero break duration', () => {
      freezeTime()
      const cb = createCircuitBreaker({ breakDuration: 0 })

      cb.recordFailure()

      // With 0 duration, should close immediately on next check
      advanceTime(1)

      expect(cb.isOpen()).toBe(false)
    })

    it('handles failure threshold of 0', () => {
      const cb = createCircuitBreaker({ breakDuration: 30_000, failureThreshold: 0 })

      // With threshold 0, a single failure should open
      cb.recordFailure()

      expect(cb.isOpen()).toBe(true)
    })

    it('handles high failure threshold', () => {
      const cb = createCircuitBreaker({ breakDuration: 30_000, failureThreshold: 1000 })

      for (let i = 0; i < 999; i++) {
        cb.recordFailure()
      }
      expect(cb.isOpen()).toBe(false)

      cb.recordFailure() // 1000th failure

      expect(cb.isOpen()).toBe(true)
    })

    it('isOpen() is idempotent during open state', () => {
      const cb = createCircuitBreaker({ breakDuration: 30_000 })

      cb.recordFailure()

      const result1 = cb.isOpen()
      const result2 = cb.isOpen()
      const result3 = cb.isOpen()

      expect(result1).toBe(true)
      expect(result2).toBe(true)
      expect(result3).toBe(true)
    })

    it('isOpen() is idempotent during closed state', () => {
      const cb = createCircuitBreaker({ breakDuration: 30_000 })

      const result1 = cb.isOpen()
      const result2 = cb.isOpen()
      const result3 = cb.isOpen()

      expect(result1).toBe(false)
      expect(result2).toBe(false)
      expect(result3).toBe(false)
    })
  })


  describe('multiple instances', () => {
    it('isolates state between instances', () => {
      const cb1 = createCircuitBreaker({ breakDuration: 30_000 })
      const cb2 = createCircuitBreaker({ breakDuration: 30_000 })

      cb1.recordFailure()

      expect(cb1.isOpen()).toBe(true)
      expect(cb2.isOpen()).toBe(false)
    })

    it('allows different configurations', () => {
      const cb1 = createCircuitBreaker({ breakDuration: 10_000, failureThreshold: 1 })
      const cb2 = createCircuitBreaker({ breakDuration: 60_000, failureThreshold: 5 })

      cb1.recordFailure()
      cb2.recordFailure()

      expect(cb1.isOpen()).toBe(true)
      expect(cb2.isOpen()).toBe(false)
    })
  })
})
