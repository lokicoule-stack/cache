/**
 * @internal
 */
export interface Scheduler {
  start(): void
  stop(): void
  isRunning(): boolean
}

/** @internal */
export function createScheduler(
  task: () => void | Promise<void>,
  intervalMs: number,
  options?: {
    onError?: (error: unknown) => void
  },
): Scheduler {
  let timer: NodeJS.Timeout | undefined
  let isRunning = false

  function schedule(): void {
    timer = setTimeout(async () => {
      if (!isRunning) {
        return
      }

      try {
        await task()
      } catch (error) {
        options?.onError?.(error)
      }

      schedule()
    }, intervalMs)
  }

  return {
    start() {
      if (isRunning) {
        return
      }
      isRunning = true
      schedule()
    },

    stop() {
      isRunning = false
      if (timer !== undefined) {
        clearTimeout(timer)
        timer = undefined
      }
    },

    isRunning() {
      return isRunning
    },
  }
}
