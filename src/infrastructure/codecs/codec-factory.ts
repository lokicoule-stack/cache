import { Base64Codec } from './base64-codec'
import { CodecError, CodecErrorCode } from './codec-errors'
import { JsonCodec } from './json-codec'
import { MsgPackCodec } from './msgpack-codec'
import { SizeValidatingCodec } from './size-validating-codec'

import type { Codec, CodecOption } from '@/contracts/codec'

function isCustomCodec(option: unknown): option is Codec {
  return typeof option === 'object' && option !== null && 'encode' in option && 'decode' in option
}

/**
 * @public
 */
export function createCodec(option?: CodecOption, maxPayloadSize?: number): Codec {
  let codec: Codec

  if (!option || option === 'msgpack') {
    codec = new MsgPackCodec()
  } else if (option === 'json') {
    codec = new JsonCodec()
  } else if (option === 'base64') {
    codec = new Base64Codec()
  } else if (isCustomCodec(option)) {
    codec = option
  } else {
    throw new CodecError(`Invalid codec type: ${String(option)}`, CodecErrorCode.INVALID_CODEC, {
      context: { codec: String(option) },
    })
  }

  if (maxPayloadSize !== undefined) {
    return new SizeValidatingCodec(codec, maxPayloadSize)
  }

  return codec
}
