/**
 * Utility for processing items in controlled batches
 *
 * Prevents overwhelming systems by limiting concurrent operations.
 * Generic helper for any batch processing scenario.
 *
 * @internal
 */
export class BatchProcessor {
  /**
   * Process items in batches with concurrency control
   *
   * @param items - Items to process
   * @param processor - Async function to process each item
   * @param concurrency - Max concurrent operations
   * @param shouldStop - Optional callback to check if processing should stop
   *
   * @example
   * ```typescript
   * await BatchProcessor.process(
   *   messages,
   *   async (msg) => await retry(msg),
   *   10,
   *   () => !scheduler.isRunning()
   * )
   * ```
   */
  static async process<T>(
    items: ReadonlyArray<T>,
    processor: (item: T) => Promise<void>,
    concurrency: number,
    shouldStop?: () => boolean
  ): Promise<void> {
    for (let i = 0; i < items.length; i += concurrency) {
      // Early exit if requested
      if (shouldStop?.()) {
        break
      }

      const batch = items.slice(i, i + concurrency)

      await Promise.allSettled(batch.map(processor))
    }
  }
}