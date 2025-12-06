/**
 * Message Bus - Serialization Tests
 *
 * Focus: Codec handling, edge cases, large payloads
 */

import { generate } from '@test/builders'
import { channels } from '@test/fixtures'
import { waitFor } from '@test/helpers/async'
import { setupBusTest } from '@test/test-setup'
import { describe, expect, it } from 'vitest'

describe('MessageBus - Serialization', () => {
  const { createBus } = setupBusTest()

  describe('JSON codec', () => {
    it('should handle complex nested objects', async () => {
      const { bus, handler } = await createBus({ codec: 'json' })
      const payload = generate.nested(3)

      await bus.subscribe(channels.standard, handler)
      await bus.publish(channels.standard, payload)

      await waitFor(() => handler.mock.calls.length > 0)
      expect(handler).toHaveBeenCalledWith(payload)
    })

    it('should handle edge case values', async () => {
      const { bus, handler } = await createBus({ codec: 'json' })

      await bus.subscribe(channels.standard, handler)

      for (const value of generate.edgeCases()) {
        await bus.publish(channels.standard, value)
      }

      await waitFor(() => handler.mock.calls.length === generate.edgeCases().length, {
        timeout: 2000,
      })
    })
  })

  describe('MsgPack codec', () => {
    it('should handle large payloads', async () => {
      const { bus, handler } = await createBus({ codec: 'msgpack' })
      const large = generate.sized(100000)

      await bus.subscribe(channels.standard, handler)
      await bus.publish(channels.standard, large)

      await waitFor(() => handler.mock.calls.length > 0)
      expect(handler).toHaveBeenCalledWith(large)
    })
  })
})
