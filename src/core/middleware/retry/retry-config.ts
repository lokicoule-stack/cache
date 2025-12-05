export interface RetryConfig {
  /**
   * Enable automatic retry on publish failure (default: true)
   */
  enabled?: boolean
}

export const DEFAULT_RETRY_CONFIG: Required<RetryConfig> = {
  enabled: true,
}
