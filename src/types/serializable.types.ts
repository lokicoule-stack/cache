/**
 * Types that can be safely serialized and deserialized
 *
 * Represents the subset of JavaScript types that can be reliably
 * converted to/from binary format without data loss. Excludes
 * functions, symbols, undefined (as values), and circular references.
 *
 * This type ensures codec safety by restricting message payloads to
 * only JSON-compatible primitives and structures. Codecs can assume
 * any Serializable value can be encoded without runtime errors.
 */
export type Serializable =
  | string
  | number
  | boolean
  | null
  | Serializable[]
  | { [key: string]: Serializable | undefined }
