import { Base64Codec } from './base64-codec'
import { CodecError, CodecErrorCode } from './codec-errors'
import { JsonCodec } from './json-codec'
import { MsgPackCodec } from './msgpack-codec'

import type { Codec, CodecOption } from '@/contracts/codec'

function isCustomCodec(option: unknown): option is Codec {
  return typeof option === 'object' && option !== null && 'encode' in option && 'decode' in option
}

/**
 * @public
 */
export function createCodec(option?: CodecOption): Codec {
  if (!option || option === 'msgpack') {
    return new MsgPackCodec()
  }

  if (option === 'json') {
    return new JsonCodec()
  }

  if (option === 'base64') {
    return new Base64Codec()
  }

  if (isCustomCodec(option)) {
    return option
  }

  throw new CodecError(`Invalid codec type: ${String(option)}`, CodecErrorCode.INVALID_CODEC, {
    context: { codec: String(option) },
  })
}
