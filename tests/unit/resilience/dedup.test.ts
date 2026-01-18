/* eslint-disable @typescript-eslint/require-await */
import { describe, it, expect, vi } from 'vitest'

import { createDedup } from '@/resilience/dedup'
import { sleep } from '../../support/time'

describe('createDedup', () => {
  describe('basic functionality', () => {
    it('executes function and returns result', async () => {
      const dedup = createDedup()

      const result = await dedup('key', async () => 'value')

      expect(result).toBe('value')
    })

    it('executes different keys independently', async () => {
      const dedup = createDedup()
      const fn1 = vi.fn(async () => 'result1')
      const fn2 = vi.fn(async () => 'result2')

      const [r1, r2] = await Promise.all([dedup('key1', fn1), dedup('key2', fn2)])

      expect(r1).toBe('result1')
      expect(r2).toBe('result2')
      expect(fn1).toHaveBeenCalledOnce()
      expect(fn2).toHaveBeenCalledOnce()
    })
  })

  describe('deduplication', () => {
    it('deduplicates concurrent calls for same key', async () => {
      const dedup = createDedup()
      let callCount = 0
      const fn = vi.fn(async () => {
        callCount++
        await sleep(50)
        return 'result'
      })

      const [r1, r2, r3] = await Promise.all([dedup('key', fn), dedup('key', fn), dedup('key', fn)])

      expect(callCount).toBe(1)
      expect(fn).toHaveBeenCalledOnce()
      expect(r1).toBe('result')
      expect(r2).toBe('result')
      expect(r3).toBe('result')
    })

    it('all concurrent calls receive same result', async () => {
      const dedup = createDedup()
      const fn = vi.fn(async () => ({ id: Math.random() }))

      const results = await Promise.all([dedup('key', fn), dedup('key', fn), dedup('key', fn)])

      expect(results[0]).toBe(results[1])
      expect(results[1]).toBe(results[2])
    })

    it('allows new calls after completion', async () => {
      const dedup = createDedup()
      let callCount = 0
      const fn = vi.fn(async () => ++callCount)

      const r1 = await dedup('key', fn)
      const r2 = await dedup('key', fn)

      expect(r1).toBe(1)
      expect(r2).toBe(2)
      expect(fn).toHaveBeenCalledTimes(2)
    })

    it('handles multiple keys concurrently', async () => {
      const dedup = createDedup()
      const calls: string[] = []

      const fn = (key: string) =>
        vi.fn(async () => {
          calls.push(key)
          await sleep(10)
          return key
        })

      const results = await Promise.all([
        dedup('a', fn('a')),
        dedup('a', fn('a')),
        dedup('b', fn('b')),
        dedup('b', fn('b')),
        dedup('c', fn('c')),
      ])

      expect(results).toEqual(['a', 'a', 'b', 'b', 'c'])
      expect(calls.filter((c) => c === 'a')).toHaveLength(1)
      expect(calls.filter((c) => c === 'b')).toHaveLength(1)
      expect(calls.filter((c) => c === 'c')).toHaveLength(1)
    })
  })

  describe('error handling', () => {
    it('propagates errors to all waiting callers', async () => {
      const dedup = createDedup()
      const error = new Error('Test error')
      const fn = vi.fn(async () => {
        await sleep(10)
        throw error
      })

      const promises = [dedup('key', fn), dedup('key', fn), dedup('key', fn)]

      await expect(Promise.all(promises)).rejects.toThrow('Test error')
      expect(fn).toHaveBeenCalledOnce()
    })

    it('clears pending entry on error', async () => {
      const dedup = createDedup()
      let callCount = 0
      const fn = vi.fn(async () => {
        callCount++
        if (callCount === 1) {
          throw new Error('First call fails')
        }
        return 'success'
      })

      await expect(dedup('key', fn)).rejects.toThrow()

      const result = await dedup('key', fn)

      expect(result).toBe('success')
      expect(fn).toHaveBeenCalledTimes(2)
    })

    it('handles synchronous errors', async () => {
      const dedup = createDedup()
      const fn = vi.fn(async () => {
        throw new Error('Sync error')
      })

      await expect(dedup('key', fn)).rejects.toThrow('Sync error')
    })
  })

  describe('type safety', () => {
    it('preserves return type', async () => {
      const dedup = createDedup()

      const numResult: number = await dedup('num', async () => 42)
      const strResult: string = await dedup('str', async () => 'hello')
      const objResult: { id: number } = await dedup('obj', async () => ({ id: 1 }))

      expect(numResult).toBe(42)
      expect(strResult).toBe('hello')
      expect(objResult).toEqual({ id: 1 })
    })
  })

  describe('edge cases', () => {
    it('handles empty string key', async () => {
      const dedup = createDedup()
      let callCount = 0

      const results = await Promise.all([
        dedup('', async () => ++callCount),
        dedup('', async () => ++callCount),
      ])

      expect(results).toEqual([1, 1])
    })

    it('handles rapid sequential calls', async () => {
      const dedup = createDedup()
      const fn = vi.fn(async () => 'result')

      // Rapid fire without awaiting
      const p1 = dedup('key', fn)
      const p2 = dedup('key', fn)
      const p3 = dedup('key', fn)

      const results = await Promise.all([p1, p2, p3])

      expect(results).toEqual(['result', 'result', 'result'])
      expect(fn).toHaveBeenCalledOnce()
    })

    it('isolates different dedup instances', async () => {
      const dedup1 = createDedup()
      const dedup2 = createDedup()
      let callCount = 0

      const results = await Promise.all([
        dedup1('key', async () => ++callCount),
        dedup2('key', async () => ++callCount),
      ])

      expect(results).toEqual([1, 2])
      expect(callCount).toBe(2)
    })

    it('handles null and undefined return values', async () => {
      const dedup = createDedup()

      const nullResult = await dedup('null', async () => null)
      const undefinedResult = await dedup('undefined', async () => undefined)

      expect(nullResult).toBeNull()
      expect(undefinedResult).toBeUndefined()
    })
  })
})
