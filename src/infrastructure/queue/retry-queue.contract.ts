import type { TransportData } from '@/core/types'

/**
 * Queued message metadata
 *
 * Represents a failed message awaiting retry. Tracks all state needed
 * for exponential backoff, dead letter handling, and debugging.
 *
 * @property id - Unique message identifier (hash or UUID)
 * @property channel - The channel the message was published to
 * @property data - The binary message payload
 * @property attempts - Number of retry attempts made so far
 * @property nextRetryAt - Timestamp when next retry should occur
 * @property createdAt - Timestamp when message was first enqueued
 * @property error - Last error message (optional, for debugging)
 */
export interface QueuedMessage {
  id: string
  channel: string
  data: TransportData
  attempts: number
  nextRetryAt: Date
  createdAt: Date
  error?: string
}