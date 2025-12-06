import { createHash, randomUUID } from 'node:crypto'

import { QueueError, QueueErrorCode } from '../retry-errors'

import type { QueuedMessage } from './retry-queue'
import type { TransportData } from '@/types'

/** @internal */
export class MessageQueue {
  #queue = new Map<string, QueuedMessage>()
  #maxSize: number
  #removeDuplicates: boolean

  constructor(maxSize: number, removeDuplicates: boolean) {
    this.#maxSize = maxSize
    this.#removeDuplicates = removeDuplicates
  }

  enqueue(
    channel: string,
    data: TransportData,
    baseDelayMs: number,
    error?: string,
  ): string | undefined {
    if (this.#queue.size >= this.#maxSize) {
      throw new QueueError(
        `Queue is full: cannot enqueue message to channel '${channel}'`,
        QueueErrorCode.QUEUE_FULL,
        {
          context: {
            channel,
            currentSize: this.#queue.size,
            maxSize: this.#maxSize,
            operation: 'enqueue',
          },
        },
      )
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

  getAll(): ReadonlyArray<QueuedMessage> {
    return Array.from(this.#queue.values())
  }

  update(message: QueuedMessage): void {
    this.#queue.set(message.id, message)
  }

  remove(id: string): boolean {
    return this.#queue.delete(id)
  }

  clear(): void {
    this.#queue.clear()
  }

  #hash(channel: string, data: TransportData): string {
    return createHash('sha256').update(channel).update(data).digest('hex')
  }
}
