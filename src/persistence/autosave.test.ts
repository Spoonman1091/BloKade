import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createEmptyDocument } from '../document/factory'
import { AUTOSAVE_DELAY_MS, createAutosaver } from './autosave'

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('autosaver', () => {
  it('saves once, 1 s after the last change', async () => {
    const save = vi.fn().mockResolvedValue(undefined)
    const saver = createAutosaver({ save, onError: vi.fn() })
    saver.schedule('d', createEmptyDocument('one'))
    await vi.advanceTimersByTimeAsync(500)
    saver.schedule('d', createEmptyDocument('two'))
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS - 1)
    expect(save).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(save).toHaveBeenCalledOnce()
    expect(save).toHaveBeenCalledWith('d', createEmptyDocument('two'))
  })

  it('flushes immediately', async () => {
    const save = vi.fn().mockResolvedValue(undefined)
    const saver = createAutosaver({ save, onError: vi.fn() })
    saver.schedule('d', createEmptyDocument())
    await saver.flush()
    expect(save).toHaveBeenCalledOnce()
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS)
    expect(save).toHaveBeenCalledOnce()
  })

  it('saves the previous design right away when switching designs', async () => {
    const save = vi.fn().mockResolvedValue(undefined)
    const saver = createAutosaver({ save, onError: vi.fn() })
    saver.schedule('a', createEmptyDocument('A'))
    saver.schedule('b', createEmptyDocument('B'))
    await vi.advanceTimersByTimeAsync(0)
    expect(save).toHaveBeenCalledWith('a', createEmptyDocument('A'))
  })

  it('reports a failure once until saving works again', async () => {
    const save = vi.fn().mockRejectedValue(new Error('quota'))
    const onError = vi.fn()
    const saver = createAutosaver({ save, onError })
    saver.schedule('d', createEmptyDocument())
    await saver.flush()
    saver.schedule('d', createEmptyDocument('again'))
    await saver.flush()
    expect(onError).toHaveBeenCalledOnce()
  })

  it('can cancel a pending save', async () => {
    const save = vi.fn().mockResolvedValue(undefined)
    const saver = createAutosaver({ save, onError: vi.fn() })
    saver.schedule('d', createEmptyDocument())
    saver.cancel()
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS)
    expect(save).not.toHaveBeenCalled()
  })

  it('flush waits for a save that is already in flight', async () => {
    let finish: () => void = () => {}
    const save = vi.fn().mockImplementation(() => new Promise<void>((resolve) => { finish = resolve }))
    const saver = createAutosaver({ save, onError: vi.fn() })
    saver.schedule('d', createEmptyDocument())
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS)
    expect(save).toHaveBeenCalledOnce()
    let flushed = false
    const flushing = saver.flush().then(() => { flushed = true })
    await vi.advanceTimersByTimeAsync(10)
    expect(flushed).toBe(false)
    finish()
    await flushing
    expect(flushed).toBe(true)
  })
})
