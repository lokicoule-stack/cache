export class CacheError extends Error {
  readonly code: string
  override readonly cause?: Error

  constructor(code: string, message: string, cause?: Error) {
    super(message)
    this.name = 'CacheError'
    this.code = code
    this.cause = cause
  }
}
