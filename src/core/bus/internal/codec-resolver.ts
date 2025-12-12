import type { Codec, CodecOption } from '@/contracts/codec'

import { CodecError, CodecErrorCode } from '@/infrastructure/codecs/codec-errors'
import { JsonCodec } from '@/infrastructure/codecs/json-codec'
import { MsgPackCodec } from '@/infrastructure/codecs/msgpack-codec'

/**
 * @internal
 */
export class CodecResolver {
  static resolve(option?: CodecOption): Codec {
    if (!option || option === 'msgpack') {
      return new MsgPackCodec()
    }

    if (option === 'json') {
      return new JsonCodec()
    }

    if (this.isCustomCodec(option)) {
      return option
    }

    throw new CodecError(`Invalid codec type: ${String(option)}`, CodecErrorCode.INVALID_CODEC, {
      context: { codec: String(option) },
    })
  }

  private static isCustomCodec(option: unknown): option is Codec {
    return typeof option === 'object' && option !== null && 'encode' in option && 'decode' in option
  }
}
