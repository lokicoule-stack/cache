import { vi, type Mock } from 'vitest'

export type LoaderFn<T> = (signal: AbortSignal) => T | Promise<T>

// Returns vi.fn() mock - use .toHaveBeenCalled() to assert
export function createLoader<T>(value: T): Mock<LoaderFn<T>> {
  return vi.fn(() => value)
}

export function createFailingLoader(
  error: Error = new Error('Loader failed'),
): Mock<LoaderFn<never>> {
  return vi.fn(() => {
    throw error
  })
}
