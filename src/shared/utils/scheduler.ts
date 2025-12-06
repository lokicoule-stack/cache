/**
 * Periodic task scheduler with lifecycle management.
 * 
 * Executes tasks at regular intervals with graceful start/stop control.
 * Errors are isolated to prevent cascade failures.
 * 
 * @example
 * ```typescript
 * const cleanup = createScheduler(
 *   async () => await purgeExpiredSessions(),
 *   60_000
 * );
 * cleanup.start();
 * // Later...
 * cleanup.stop();
 * ```
 * 
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
  }
): Scheduler {
  let timer: NodeJS.Timeout | undefined;
  let isRunning = false;

  function schedule(): void {
    timer = setTimeout(async () => {
      if (!isRunning) {return;}

      try {
        await task();
      } catch (error) {
        options?.onError?.(error);
      }

      schedule();
    }, intervalMs);
  }

  return {
    start() {
      if (isRunning) {return;}
      isRunning = true;
      schedule();
    },

    stop() {
      isRunning = false;
      if (timer !== undefined) {
        clearTimeout(timer);
        timer = undefined;
      }
    },

    isRunning() {
      return isRunning;
    },
  };
}