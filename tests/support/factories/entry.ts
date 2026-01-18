import { CacheEntry } from '@/index'
import { advanceTime } from '../time'

export interface EntryFactoryOptions {
  value?: unknown
  staleTime?: number
  gcTime?: number
  tags?: string[]
}

export function createEntry(options: EntryFactoryOptions = {}): CacheEntry {
  return CacheEntry.create(options.value ?? 'test-value', {
    staleTime: options.staleTime ?? 60_000,
    gcTime: options.gcTime ?? options.staleTime ?? 60_000,
    tags: options.tags,
  })
}

// Entry already past staleTime - use advanceTime(10) after creation
export function createStaleEntry(options: EntryFactoryOptions = {}): CacheEntry {
  const entry = createEntry({ ...options, staleTime: 1 })
  advanceTime(10)
  return entry
}

// Entry already past gcTime - use advanceTime(10) after creation
export function createExpiredEntry(options: EntryFactoryOptions = {}): CacheEntry {
  const entry = createEntry({ ...options, staleTime: 1, gcTime: 1 })
  advanceTime(10)
  return entry
}
