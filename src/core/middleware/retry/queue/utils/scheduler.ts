/**
 * @internal
 */
export interface Scheduler {
  start(): void
  stop(): void
  isRunning(): boolean
}

/**
 * Options for scheduler creation.
 */
interface SchedulerOptions {
  /** Error handler for task failures */
  onError?: (error: Error) => void
}

// Prevent memory leaks by tracking schedulers for cleanup on exit
const activeSchedulers = new Set<Scheduler>()
let cleanupRegistered = false

function registerCleanup(): void {
  if (cleanupRegistered) {
    return
  }

  cleanupRegistered = true

  process.on('exit', stopAllSchedulers)

  // Handle signals to ensure clean shutdown in containerized environments
  const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM', 'SIGHUP']

  signals.forEach((signal) => {
    process.on(signal, () => {
      stopAllSchedulers()
      process.exit(0)
    })
  })
}

function stopAllSchedulers(): void {
  activeSchedulers.forEach((scheduler) => scheduler.stop())
  activeSchedulers.clear()
}

/**
 * @internal
 */
export function createScheduler(
  task: () => void | Promise<void>,
  intervalMs: number,
  options?: SchedulerOptions,
): Scheduler {
  let timer: NodeJS.Timeout | undefined
  let running = false

  function scheduleNext(): void {
    if (!running) {
      return
    }

    timer = setTimeout(async () => {
      // Avoid race condition if stopped during timeout
      if (!running) {
        return
      }

      try {
        await task()
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error))

        options?.onError?.(err)
      }

      // Recursive pattern ensures interval between task completions, not starts
      scheduleNext()
    }, intervalMs)
  }

  const scheduler: Scheduler = {
    start() {
      if (running) {
        return
      }

      running = true
      activeSchedulers.add(scheduler)
      registerCleanup()
      scheduleNext()
    },

    stop() {
      running = false

      if (timer !== undefined) {
        clearTimeout(timer)
        timer = undefined
      }

      activeSchedulers.delete(scheduler)
    },

    isRunning() {
      return running
    },
  }

  return scheduler
}
