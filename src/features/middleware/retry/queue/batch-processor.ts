/**
 * Utility for processing items in controlled batches
 *
 * Prevents overwhelming systems by limiting concurrent operations.
 *
 * @internal
 */
export class BatchProcessor {

  static async process<T>(
    items: ReadonlyArray<T>,
    processor: (item: T) => Promise<void>,
    concurrency: number,
    shouldStop?: () => boolean
  ): Promise<void> {
    for (let i = 0; i < items.length; i += concurrency) {
      if (shouldStop?.()) {
        break
      }

      const batch = items.slice(i, i + concurrency)

      await Promise.allSettled(batch.map(processor))
    }
  }
}