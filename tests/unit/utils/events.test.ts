import { describe, it, expect, vi } from 'vitest'

import { createEventEmitter } from '@/utils/events'

describe('createEventEmitter', () => {
  it('calls listener when event is emitted', () => {
    const emitter = createEventEmitter()
    const listener = vi.fn()

    emitter.on('hit', listener)
    emitter.emit('hit', { key: 'foo', store: 'default', driver: 'memory', graced: false, duration: 10 })

    expect(listener).toHaveBeenCalledWith({
      key: 'foo',
      store: 'default',
      driver: 'memory',
      graced: false,
      duration: 10,
    })
  })

  it('does not call listener for different event', () => {
    const emitter = createEventEmitter()
    const listener = vi.fn()

    emitter.on('hit', listener)
    emitter.emit('miss', { key: 'foo', store: 'default', duration: 10 })

    expect(listener).not.toHaveBeenCalled()
  })

  it('stops calling listener after off', () => {
    const emitter = createEventEmitter()
    const listener = vi.fn()

    emitter.on('hit', listener)
    emitter.off('hit', listener)
    emitter.emit('hit', { key: 'foo', store: 'default', driver: 'memory', graced: false, duration: 10 })

    expect(listener).not.toHaveBeenCalled()
  })

  it('calls multiple listeners for same event', () => {
    const emitter = createEventEmitter()
    const listener1 = vi.fn()
    const listener2 = vi.fn()

    emitter.on('hit', listener1)
    emitter.on('hit', listener2)
    emitter.emit('hit', { key: 'foo', store: 'default', driver: 'memory', graced: false, duration: 10 })

    expect(listener1).toHaveBeenCalledOnce()
    expect(listener2).toHaveBeenCalledOnce()
  })
})
