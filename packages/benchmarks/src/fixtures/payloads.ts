export type PayloadSize = 'small' | 'medium' | 'large'

export interface PayloadDefinition {
  id: string
  name: string
  email: string
  age: number
  active: boolean
  metadata: Record<string, unknown>
  createdAt: string
  padding?: string
}

function createPayload(size: number): PayloadDefinition {
  const basePayload: PayloadDefinition = {
    id: 'user-12345',
    name: 'John Doe',
    email: 'john.doe@example.com',
    age: 30,
    active: true,
    metadata: {
      role: 'admin',
      department: 'engineering',
      projects: ['project-a', 'project-b'],
    },
    createdAt: new Date().toISOString(),
  }

  const currentSize = JSON.stringify(basePayload).length

  if (currentSize < size) {
    const paddingNeeded = size - currentSize
    basePayload.padding = 'x'.repeat(paddingNeeded)
  }

  return basePayload
}

export const payloads = {
  small: createPayload(100),
  medium: createPayload(1024),
  large: createPayload(102_400),
}

export function getPayload(size: PayloadSize): PayloadDefinition {
  return payloads[size]
}

export function getPayloadByBytes(bytes: number): PayloadDefinition {
  if (bytes <= 100) return payloads.small
  if (bytes <= 1024) return payloads.medium
  return payloads.large
}
