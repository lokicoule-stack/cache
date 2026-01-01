import { describe, it, expect, vi } from 'vitest'

import { withSwr } from '@/utils/swr'

describe('withSwr', () => {
  it('executes fn when no stale value', async () => {
    const result = await withSwr(() => Promise.resolve('fresh'))

    expect(result).toEqual({ value: 'fresh', stale: false })
  })

  it('returns stale immediately when timeout is 0', async () => {
    const fn = vi.fn().mockResolvedValue('fresh')

    const result = await withSwr(fn, { staleValue: 'stale', timeout: 0 })

    expect(result).toEqual({ value: 'stale', stale: true })
  })

  it('returns fresh when fn completes before timeout', async () => {
    const result = await withSwr(() => Promise.resolve('fresh'), {
      staleValue: 'stale',
      timeout: 100,
    })

    expect(result).toEqual({ value: 'fresh', stale: false })
  })

  it('returns stale when fn exceeds timeout', async () => {
    const slowFn = () => new Promise<string>((r) => setTimeout(() => r('fresh'), 200))

    const result = await withSwr(slowFn, { staleValue: 'stale', timeout: 10 })

    expect(result).toEqual({ value: 'stale', stale: true })
  })

  it('executes fn without SWR when no timeout specified', async () => {
    const result = await withSwr(() => Promise.resolve('fresh'), { staleValue: 'stale' })

    expect(result).toEqual({ value: 'fresh', stale: false })
  })

  it('passes AbortSignal to fn', async () => {
    let receivedSignal: AbortSignal | undefined

    await withSwr((signal) => {
      receivedSignal = signal
      return Promise.resolve('ok')
    })

    expect(receivedSignal).toBeInstanceOf(AbortSignal)
  })
})
