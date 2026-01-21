/**
 * Testcontainers Support Utilities
 *
 * Use to conditionally skip integration tests when Docker unavailable.
 */

import { execSync } from 'node:child_process'

export function isDockerAvailable(): boolean {
  try {
    execSync('docker info', { stdio: 'ignore', timeout: 5000 })
    return true
  } catch {
    return false
  }
}

export function getDockerSkipMessage(): string {
  return 'Docker is not available or not running. Install Docker and ensure the daemon is running.'
}
