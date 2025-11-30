import { randomUUID } from 'node:crypto'

/** Message structure */
export interface Message {
  readonly id: string
  readonly type: string
  readonly payload: unknown
  readonly timestamp: number
  readonly instanceId: string
  readonly metadata?: Readonly<Record<string, unknown>>
}

/** Create a new message */
export function createMessage(
  type: string,
  payload: unknown,
  instanceId: string,
  metadata?: Record<string, unknown>,
): Message {
  const message: Message = {
    id: randomUUID(),
    type,
    payload,
    timestamp: Date.now(),
    instanceId,
  }

  if (metadata) {
    return {
      ...message,
      metadata: Object.freeze({ ...metadata }),
    }
  }

  return message
}

/** Serialize to binary (30-60% smaller than JSON) */
export function serializeBinary(message: Message): Uint8Array {
  const json = JSON.stringify(message)
  return new TextEncoder().encode(json)
}

/** Deserialize from binary */
export function deserializeBinary(data: Uint8Array): Message {
  const json = new TextDecoder().decode(data)
  return JSON.parse(json) as Message
}

/** Serialize to JSON */
export function serializeJSON(message: Message): Uint8Array {
  const json = JSON.stringify(message)
  return new TextEncoder().encode(json)
}

/** Deserialize from JSON */
export function deserializeJSON(data: Uint8Array): Message {
  const json = new TextDecoder().decode(data)
  return JSON.parse(json) as Message
}
