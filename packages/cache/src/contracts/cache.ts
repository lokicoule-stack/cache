import type { GetOptions, Loader, SetOptions, GetSetOptions } from '../types/options'

/**
 * Cache with runtime-typed keys and values.
 * Use when schema is dynamic or unknown at compile time.
 */
export interface GenericCache {
  get<V = unknown>(key: string, options?: GetOptions): Promise<V | undefined>
  set<V = unknown>(key: string, value: V, options?: SetOptions): Promise<void>
  getOrSet<V = unknown>(key: string, loader: Loader<V>, options?: GetSetOptions): Promise<V>
  delete(...keys: string[]): Promise<number>
  has(key: string): Promise<boolean>
  clear(): Promise<void>
  invalidateTags(tags: string[]): Promise<number>
  pull<V = unknown>(key: string): Promise<V | undefined>
  expire(key: string): Promise<boolean>
  namespace(prefix: string): GenericCache
  connect(): Promise<void>
  disconnect(): Promise<void>
}

/**
 * Cache with schema-locked compile-time key-value validation.
 * Use when schema is fixed and known at compile time.
 */
export interface Cache<T extends Record<string, unknown>> {
  get<K extends keyof T>(key: K, options?: GetOptions): Promise<T[K] | undefined>
  set<K extends keyof T>(key: K, value: T[K], options?: SetOptions): Promise<void>
  getOrSet<K extends keyof T>(key: K, loader: Loader<T[K]>, options?: GetSetOptions): Promise<T[K]>
  delete(...keys: (keyof T)[]): Promise<number>
  has(key: keyof T): Promise<boolean>
  clear(): Promise<void>
  invalidateTags(tags: string[]): Promise<number>
  pull<K extends keyof T>(key: K): Promise<T[K] | undefined>
  expire(key: keyof T): Promise<boolean>
  namespace(prefix: string): Cache<T>
  connect(): Promise<void>
  disconnect(): Promise<void>
}
