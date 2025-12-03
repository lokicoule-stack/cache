/**
 * Retry middleware configuration
 */
export interface RetryConfig {
  /**
   * Enable automatic retry on publish failure (default: true)
   */
  enabled?: boolean
}

/**
 * Default retry configuration
 */
export const DEFAULT_RETRY_CONFIG: Required<RetryConfig> = {
  enabled: true,
}
