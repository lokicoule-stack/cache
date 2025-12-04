/**
 * Periodic task scheduler
 *
 * Manages timer lifecycle with start/stop control and recursive scheduling.
 * Executes a task function at regular intervals.
 * 
 * @internal
 */
export class Scheduler {
  #task: () => void | Promise<void>
  #intervalMs: number
  #timer?: NodeJS.Timeout
  #isRunning = false
 
  constructor(task: () => void | Promise<void>, intervalMs: number) {
    this.#task = task
    this.#intervalMs = intervalMs
  }
  
  start(): void {
    if (this.#isRunning) {
      return
    }
    this.#isRunning = true
    this.#schedule()
  }
  
  stop(): void {
    this.#isRunning = false
    if (this.#timer) {
      clearTimeout(this.#timer)
      this.#timer = undefined
    }
  }

  isRunning(): boolean {
    return this.#isRunning
  }
 
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

      this.#schedule()
    }, this.#intervalMs)
  }
}
