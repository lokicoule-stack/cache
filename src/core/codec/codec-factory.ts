import type { CodecOption, Codec } from './codec.contract'

import { JsonCodec, MsgPackCodec } from '@/infrastructure/codecs'
import { InvalidCodecError } from '@/shared/errors'

export function createCodec(option?: CodecOption): Codec {
  if (!option || option === 'json') {
    return new JsonCodec()
  }

  if (option === 'msgpack') {
    return new MsgPackCodec()
  }

  if (typeof option === 'object' && 'encode' in option && 'decode' in option) {
    return option
  }

  throw new InvalidCodecError(String(option))
}
