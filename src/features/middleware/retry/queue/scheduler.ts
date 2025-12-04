/**
 * Internal periodic task scheduler
 *
 * Manages timer lifecycle with start/stop control and recursive scheduling.
 * Executes a task function at regular intervals. Used internally by
 * RetryQueue for periodic message processing.
 *
 * Features:
 * - Recursive setTimeout pattern (not setInterval)
 * - Graceful start/stop lifecycle
 * - Error handling without stopping scheduler
 * - Idempotent start/stop operations
 *
 * @internal
 */
export class Scheduler {
  #task: () => void | Promise<void>
  #intervalMs: number
  #timer?: NodeJS.Timeout
  #isRunning = false

  /**
   * Create scheduler
   *
   * @param task - Async function to execute periodically
   * @param intervalMs - Interval between executions
   */
  constructor(task: () => void | Promise<void>, intervalMs: number) {
    this.#task = task
    this.#intervalMs = intervalMs
  }

  /**
   * Start the scheduler
   *
   * Begins periodic task execution. Idempotent - safe to call multiple times.
   */
  start(): void {
    if (this.#isRunning) {
      return
    }
    this.#isRunning = true
    this.#schedule()
  }

  /**
   * Stop the scheduler
   *
   * Halts task execution and clears timer. Idempotent.
   */
  stop(): void {
    this.#isRunning = false
    if (this.#timer) {
      clearTimeout(this.#timer)
      this.#timer = undefined
    }
  }

  /**
   * Check if scheduler is running
   *
   * @returns True if scheduler is active, false otherwise
   */
  isRunning(): boolean {
    return this.#isRunning
  }

  /**
   * Schedule next task execution
   *
   * Uses recursive setTimeout pattern to ensure tasks complete
   * before scheduling next execution.
   *
   * @private
   */
  #schedule(): void {
    this.#timer = setTimeout(async () => {
      if (!this.#isRunning) {
        return
      }

      try {
        await this.#task()
      } catch {
        // Swallow errors to prevent scheduler from stopping
      }

      // Recursively schedule next execution
      this.#schedule()
    }, this.#intervalMs)
  }
}
