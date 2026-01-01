import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import { createCircuitBreaker } from '@/utils/circuit-breaker'

describe('createCircuitBreaker', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('starts closed', () => {
    const breaker = createCircuitBreaker(1000)

    expect(breaker.isOpen()).toBe(false)
  })

  it('opens when open() is called', () => {
    const breaker = createCircuitBreaker(1000)

    breaker.open()

    expect(breaker.isOpen()).toBe(true)
  })

  it('closes after breakDuration', () => {
    const breaker = createCircuitBreaker(1000)

    breaker.open()
    vi.advanceTimersByTime(1000)

    expect(breaker.isOpen()).toBe(false)
  })

  it('stays open before breakDuration', () => {
    const breaker = createCircuitBreaker(1000)

    breaker.open()
    vi.advanceTimersByTime(999)

    expect(breaker.isOpen()).toBe(true)
  })

  it('closes immediately when close() is called', () => {
    const breaker = createCircuitBreaker(1000)

    breaker.open()
    breaker.close()

    expect(breaker.isOpen()).toBe(false)
  })
})
