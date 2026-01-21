export function generateKeys(count: number, prefix = 'key'): string[] {
  return Array.from({ length: count }, (_, i) => `${prefix}:${i}`)
}

export function randomKey(keys: string[]): string {
  return keys[Math.floor(Math.random() * keys.length)]!
}

export function uniqueKey(prefix = 'unique'): string {
  return `${prefix}:${Date.now()}:${Math.random().toString(36).slice(2)}`
}
