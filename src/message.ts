import { randomUUID } from 'node:crypto'

export interface Message {
  readonly id: string
  readonly type: string
  readonly payload: unknown
  readonly timestamp: number
  readonly instanceId: string
  readonly metadata?: Readonly<Record<string, unknown>>
}

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

export function serializeBinary(message: Message): Uint8Array {
  const json = JSON.stringify(message)
  return new TextEncoder().encode(json)
}

export function deserializeBinary(data: Uint8Array): Message {
  const json = new TextDecoder().decode(data)
  return JSON.parse(json) as Message
}

export function serializeJSON(message: Message): Uint8Array {
  const json = JSON.stringify(message)
  return new TextEncoder().encode(json)
}

export function deserializeJSON(data: Uint8Array): Message {
  const json = new TextDecoder().decode(data)
  return JSON.parse(json) as Message
}
