import { decode, encode } from '@msgpack/msgpack'

import type { Serializable, TransportData } from './types'

export type CodecType = 'json' | 'msgpack'

export type CodecOption = CodecType | ICodec

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
 */
export class MsgPackCodec implements ICodec {
  encode<T extends Serializable>(data: T): TransportData {
    return new Uint8Array(encode(data))
  }

  decode<T extends Serializable>(data: TransportData): T {
    return decode(Buffer.from(data)) as T
  }
}

export const resolveCodec = (codec?: CodecOption): ICodec => {
  if (!codec || codec === 'json') {return new JsonCodec()}
  if (codec === 'msgpack') {return new MsgPackCodec()}
  if (typeof codec === 'string') {return new JsonCodec()}
  return codec
}