export async function waitFor(
  condition: () => boolean | Promise<boolean>,
  options: { timeout?: number; interval?: number } = {},
): Promise<void> {
  const { timeout = 1000, interval = 10 } = options
  const start = Date.now()

  while (true) {
    if (await condition()) return

    if (Date.now() - start > timeout) {
      throw new Error(`Timeout after ${timeout}ms`)
    }

    await new Promise((r) => setTimeout(r, interval))
  }
}
