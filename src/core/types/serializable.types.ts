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
 *
 * @example
 * ```typescript
 * // ✅ Valid Serializable types
 * const primitive: Serializable = 'hello'
 * const number: Serializable = 42
 * const object: Serializable = { name: 'Alice', age: 30 }
 * const array: Serializable = [1, 2, 3]
 * const nested: Serializable = { users: [{ id: 1, name: 'Bob' }] }
 * const nullable: Serializable = null
 * const optional: Serializable = { key: undefined } // undefined as object value is OK
 *
 * // ❌ Invalid - will not compile
 * const fn: Serializable = () => {} // Functions not allowed
 * const sym: Serializable = Symbol('x') // Symbols not allowed
 * const topLevelUndefined: Serializable = undefined // undefined as top-level value not allowed
 * ```
 */
export type Serializable =
  | string
  | number
  | boolean
  | null
  | Serializable[]
  | { [key: string]: Serializable | undefined }
