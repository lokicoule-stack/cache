import { createHash, randomUUID } from 'node:crypto'

import type { QueuedMessage } from './retry-queue.contract'
import type { TransportData } from '@/types'

import { QueueFullError } from '@/shared/errors'

/**
 * Internal message storage component
 *
 * Manages in-memory queue with Map-based storage and SHA-256 deduplication.
 * Handles CRUD operations and enforces size limits. Used internally by
 * RetryQueue - not exposed as public API.
 *
 * Features:
 * - O(1) lookups via Map<string, QueuedMessage>
 * - Optional duplicate detection via content hashing
 * - Configurable size limits with QueueFullError
 * - Immutable snapshots for iteration
 *
 * @internal
 */
export class MessageQueue {
  #queue = new Map<string, QueuedMessage>()
  #maxSize: number
  #removeDuplicates: boolean

  /**
   * Create message queue
   *
   * @param maxSize - Maximum queue capacity
   * @param removeDuplicates - Enable SHA-256 deduplication
   */
  constructor(maxSize: number, removeDuplicates: boolean) {
    this.#maxSize = maxSize
    this.#removeDuplicates = removeDuplicates
  }

  /**
   * Enqueue a message
   *
   * @param channel - Target channel
   * @param data - Message payload
   * @param baseDelayMs - Initial retry delay
   * @param error - Optional error message
   * @returns Message ID if enqueued, undefined if duplicate
   * @throws {QueueFullError} If queue at capacity
   */
  enqueue(channel: string, data: TransportData, baseDelayMs: number, error?: string): string | undefined {
    if (this.#queue.size >= this.#maxSize) {
      throw new QueueFullError(this.#maxSize, channel)
    }

    const id = this.#removeDuplicates ? this.#hash(channel, data) : randomUUID()

    if (this.#removeDuplicates && this.#queue.has(id)) {
      return undefined
    }

    this.#queue.set(id, {
      id,
      channel,
      data,
      attempts: 0,
      nextRetryAt: new Date(Date.now() + baseDelayMs),
      createdAt: new Date(),
      error,
    })

    return id
  }

  /**
   * Get message by ID
   *
   * @param id - Message identifier
   * @returns Message if exists, undefined otherwise
   */
  get(id: string): QueuedMessage | undefined {
    return this.#queue.get(id)
  }

  /**
   * Get all messages as array
   *
   * @returns Immutable snapshot of all queued messages
   */
  getAll(): ReadonlyArray<QueuedMessage> {
    return Array.from(this.#queue.values())
  }

  /**
   * Update existing message
   *
   * @param message - Updated message object
   */
  update(message: QueuedMessage): void {
    this.#queue.set(message.id, message)
  }

  /**
   * Remove message by ID
   *
   * @param id - Message identifier
   * @returns True if removed, false if not found
   */
  remove(id: string): boolean {
    return this.#queue.delete(id)
  }

  /**
   * Clear all messages
   */
  clear(): void {
    this.#queue.clear()
  }

  /**
   * Generate SHA-256 hash for deduplication
   *
   * @param channel - Channel name
   * @param data - Message data
   * @returns Hex-encoded hash
   * @private
   */
  #hash(channel: string, data: TransportData): string {
    return createHash('sha256').update(channel).update(data).digest('hex')
  }
}
