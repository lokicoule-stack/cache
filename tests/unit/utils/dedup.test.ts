import { describe, it, expect, vi } from 'vitest'

import { createDedup } from '@/utils/dedup'

describe('createDedup', () => {
  it('executes loader and returns result', async () => {
    const dedup = createDedup()

    const result = await dedup('key', () => Promise.resolve('value'))

    expect(result).toBe('value')
  })

  it('shares pending promise for same key', async () => {
    const dedup = createDedup()
    const loader = vi.fn().mockResolvedValue('shared')

    await Promise.all([dedup('key', loader), dedup('key', loader)])

    expect(loader).toHaveBeenCalledOnce()
  })

  it('runs separate loaders for different keys', async () => {
    const dedup = createDedup()
    const loader = vi.fn().mockResolvedValue('x')

    await Promise.all([dedup('a', loader), dedup('b', loader)])

    expect(loader).toHaveBeenCalledTimes(2)
  })

  it('clears key after promise resolves', async () => {
    const dedup = createDedup()
    const loader = vi.fn().mockResolvedValue('x')

    await dedup('key', loader)
    await dedup('key', loader)

    expect(loader).toHaveBeenCalledTimes(2)
  })

  it('clears key after promise rejects', async () => {
    const dedup = createDedup()

    await dedup('key', () => Promise.reject(new Error('fail'))).catch(() => {})
    const result = await dedup('key', () => Promise.resolve('ok'))

    expect(result).toBe('ok')
  })
})
