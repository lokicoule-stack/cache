import type { Codec, CodecOption } from '@/contracts/codec'

import { JsonCodec, MsgPackCodec } from '@/infrastructure/codecs'
import { InvalidCodecError } from '@/infrastructure/codecs/codec-errors'

export function resolveCodec(option?: CodecOption): Codec {
  if (!option || option === 'json') {
    return new JsonCodec()
  }

  if (option === 'msgpack') {
    return new MsgPackCodec()
  }

  // Direct injection (duck typing check)
  if (typeof option === 'object' && 'encode' in option && 'decode' in option) {
    return option
  }

  throw new InvalidCodecError(String(option))
}
