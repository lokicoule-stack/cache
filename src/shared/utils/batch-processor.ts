/**
 * Processes items in controlled batches with bounded concurrency.
 * 
 * @internal
 */
export async function processBatch<T>(
  items: ReadonlyArray<T>,
  processor: (item: T) => Promise<void>,
  concurrency: number,
  shouldStop?: () => boolean
): Promise<void> {
  for (let i = 0; i < items.length; i += concurrency) {
    if (shouldStop?.()) {break;}

    const batch = items.slice(i, i + concurrency);

    await Promise.allSettled(batch.map(processor));
  }
}