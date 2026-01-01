import { describe, it, expect, vi } from 'vitest'

import { withRetry } from '@/utils/retry'

describe('withRetry', () => {
  it('returns result on first success', async () => {
    const result = await withRetry(() => Promise.resolve('ok'), 2)

    expect(result).toBe('ok')
  })

  it('retries on failure and returns success', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValue('ok')

    const result = await withRetry(fn, 1)

    expect(result).toBe('ok')
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('throws after exhausting retries', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('always fails'))

    await expect(withRetry(fn, 2)).rejects.toThrow('always fails')
    expect(fn).toHaveBeenCalledTimes(3) // 1 initial + 2 retries
  })

  it('retries = 0 means single attempt', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('fail'))

    await expect(withRetry(fn, 0)).rejects.toThrow('fail')
    expect(fn).toHaveBeenCalledOnce()
  })
})
