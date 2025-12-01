import type { Serializable, TransportData } from './types'

/**
 * Codec interface
 */
export interface ICodec {
  encode<T extends Serializable>(data: T): TransportData
  decode<T extends Serializable>(data: TransportData): T
}

/**
 * JSON codec
 */
export class JsonCodec implements ICodec {
  encode<T extends Serializable>(data: T): TransportData {
    return new TextEncoder().encode(JSON.stringify(data))
  }

  decode<T extends Serializable>(data: TransportData): T {
    return JSON.parse(new TextDecoder().decode(data)) as T
  }
}

/**
 * MessagePack codec
 *//*
export class MsgPackCodec implements ICodec {
  encode<T extends Serializable>(data: T): TransportData {
    return new Uint8Array(msgpack.encode(data))
  }

  decode<T extends Serializable>(data: TransportData): T {
    return msgpack.decode(Buffer.from(data)) as T
  }
} */