import { JsonCodec, MsgPackCodec } from '../../infrastructure/codecs'
import { InvalidCodecError } from '../../shared/errors'

import type { CodecOption, ICodec } from './codec.contract'

/**
 * Factory function to resolve codec from option
 *
 * Accepts either a predefined codec type string or a custom ICodec
 * implementation. Returns a ready-to-use codec instance.
 *
 * @param option - Codec type or custom codec implementation (default: 'json')
 * @returns Resolved codec instance
 * @throws {InvalidCodecError} If codec type is not recognized
 *
 * @example
 * ```typescript
 * // Using predefined codecs
 * const jsonCodec = createCodec('json')
 * const msgpackCodec = createCodec('msgpack')
 * const defaultCodec = createCodec() // defaults to 'json'
 *
 * // Using custom codec
 * const customCodec = createCodec({
 *   name: 'protobuf',
 *   encode: (data) => ...,
 *   decode: (data) => ...
 * })
 * ```
 */
export function createCodec(option?: CodecOption): ICodec {
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
