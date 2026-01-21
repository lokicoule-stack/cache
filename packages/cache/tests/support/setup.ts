import { beforeEach, afterEach } from 'vitest'
import { vi } from 'vitest'

// Call at module level to auto-setup/teardown vi.useFakeTimers for all tests
export function setupTestTimers(): void {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })
}
