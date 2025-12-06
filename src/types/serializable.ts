/** @public */
export type SerializablePrimitive = string | number | boolean | null;

/** @public */
export interface SerializableObject {
  [key: string]: Serializable | undefined
}

/**
 * Value that can be JSON serialized.
 * @public
 */
export type Serializable =
  | SerializablePrimitive
  | SerializableObject
  | Serializable[];
