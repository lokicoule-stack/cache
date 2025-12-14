import { describe, expect, it, vi } from 'vitest'
import { CodecErrorCode } from '@/infrastructure/codecs'
import { BusBuilder } from '@test/builders'
import { waitFor } from '@test/helpers'

describe('Payload Size Limit Integration', () => {
  it('rejects oversized payloads on publish', async () => {
    const bus = BusBuilder.create().withMaxPayloadSize(100).build()
    await bus.connect()

    await expect(bus.publish('test', { msg: 'x'.repeat(200) })).rejects.toMatchObject({
      code: CodecErrorCode.PAYLOAD_TOO_LARGE,
      context: { operation: 'encode' },
    })

    await bus.disconnect()
  })

  it('rejects oversized payloads on subscribe', async () => {
    const onError = vi.fn()
    const { bus, transport } = BusBuilder.create()
      .withMaxPayloadSize(100)
      .withErrorHandler(onError)
      .buildWithTransport()

    await bus.connect()
    const handler = vi.fn()
    await bus.subscribe('test', handler)

    transport.simulateMessage(
      'test',
      new TextEncoder().encode(JSON.stringify({ msg: 'x'.repeat(200) })),
    )

    await waitFor(() => onError.mock.calls.length > 0)

    expect(handler).not.toHaveBeenCalled()
    expect((onError.mock.calls[0][1] as { code: string }).code).toBe(
      CodecErrorCode.PAYLOAD_TOO_LARGE,
    )

    await bus.disconnect()
  })
})
