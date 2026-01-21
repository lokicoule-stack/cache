import type { Cache, GenericCache } from './cache'
import type { GetOptions, GetSetOptions, Loader, SetOptions } from '../types/options'

/**
 * Cache manager with runtime-typed keys and values.
 * Use when schema is dynamic or unknown at compile time.
 */
export interface GenericCacheManager {
  use(name?: string): GenericCache
  get<V = unknown>(key: string, options?: GetOptions): Promise<V | undefined>
  set<V = unknown>(key: string, value: V, options?: SetOptions): Promise<void>
  getOrSet<V = unknown>(key: string, loader: Loader<V>, options?: GetSetOptions): Promise<V>
  delete(...keys: string[]): Promise<number>
  has(key: string): Promise<boolean>
  clear(): Promise<void>
  invalidateTags(tags: string[]): Promise<number>
  connect(): Promise<void>
  disconnect(): Promise<void>
}

/**
 * Cache manager with schema-locked compile-time key-value validation.
 * Use when schema is fixed and known at compile time.
 */
export interface CacheManager<T extends Record<string, unknown>> {
  use(name?: string): Cache<T>
  get<K extends keyof T>(key: K, options?: GetOptions): Promise<T[K] | undefined>
  set<K extends keyof T>(key: K, value: T[K], options?: SetOptions): Promise<void>
  getOrSet<K extends keyof T>(key: K, loader: Loader<T[K]>, options?: GetSetOptions): Promise<T[K]>
  delete(...keys: (keyof T)[]): Promise<number>
  has(key: keyof T): Promise<boolean>
  clear(): Promise<void>
  invalidateTags(tags: string[]): Promise<number>
  connect(): Promise<void>
  disconnect(): Promise<void>
}
