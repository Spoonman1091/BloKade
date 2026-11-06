// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { printerStore } from '../../printers/printer-store'
import { DEFAULT_PRINTER } from '../../printers/printers'
import { THIN_TONGUE_MESSAGE } from '../../split/constants'
import type { Cut } from '../../split/types'
import { moveCutIn, misfitMessage } from './split-rules'
import { fakeSplitClient } from './testing/fake-split-client'
import { useSplit } from './useSplit'

vi.mock('../../app/download', () => ({ downloadBytes: vi.fn() }))
afterEach(() => { cleanup(); printerStore.getState().setPrinter(DEFAULT_PRINTER) })

const file = () => new File([new Uint8Array([1, 2, 3])], 'a.stl')

async function planned(options = {}) {
  const fake = fakeSplitClient(options)
  const hook = renderHook(() => useSplit(fake.client))
  await act(async () => { await hook.result.current.open(file(), 'mm') })
  await waitFor(() => expect(hook.result.current.stage).toBe('planned'))
  return { ...fake, hook }
}

describe('useSplit', () => {
  it('starts empty, then opens and plans on its own', async () => {
    const fake = fakeSplitClient()
    const hook = renderHook(() => useSplit(fake.client))
    expect(hook.result.current.stage).toBe('empty')
    await act(async () => { await hook.result.current.open(file(), 'mm') })
    await waitFor(() => expect(hook.result.current.stage).toBe('planned'))
    expect(hook.result.current.settings.baseThickness).toBe(6.4)
    expect(hook.result.current.grid?.cols).toBe(2)
    expect(hook.result.current.busy).toBeNull()
  })

  it('moves a cut inside its window and next to its neighbour, and makes pieces stale', async () => {
    const { hook } = await planned()
    await act(async () => { await hook.result.current.makePieces() })
    expect(hook.result.current.stage).toBe('pieces')
    act(() => hook.result.current.moveCut(0, 500))
    expect(hook.result.current.grid?.cuts[0]?.at).toBe(60)
    expect(hook.result.current.stage).toBe('planned')
    expect(hook.result.current.pieces).toBeNull()
  })

  it('treats a cancelled call silently and keeps the stage', async () => {
    const { hook, client } = await planned({ hangPieces: true })
    let made: Promise<void> | undefined
    act(() => { made = hook.result.current.makePieces() })
    await waitFor(() => expect(hook.result.current.busy).toBe('making'))
    act(() => hook.result.current.cancel())
    await act(async () => { await made })
    expect(client.cancel).toHaveBeenCalled()
    expect(hook.result.current.busy).toBeNull()
    expect(hook.result.current.stage).toBe('planned')
    expect(hook.result.current.messages).toEqual([])
  })

  it('reports the thin tongue message under 4 mm', async () => {
    const { hook } = await planned({ base: 3 })
    expect(hook.result.current.messages).toContain(THIN_TONGUE_MESSAGE)
  })
})

describe('split rules', () => {
  const cuts: readonly Cut[] = [
    { axis: 'x', min: -50, max: 50, at: -10 },
    { axis: 'y', min: -50, max: 50, at: 0 },
    { axis: 'x', min: -30, max: 80, at: 20 },
  ]
  it('clamps to the window and keeps cuts on one axis 1 mm apart and in order', () => {
    expect(moveCutIn(cuts, 0, -99)[0]?.at).toBe(-50)
    expect(moveCutIn(cuts, 0, 99)[0]?.at).toBe(19)
    expect(moveCutIn(cuts, 2, -99)[2]?.at).toBe(-9)
    expect(moveCutIn(cuts, 2, 99)[2]?.at).toBe(80)
    expect(moveCutIn(cuts, 1, 7)[1]?.at).toBe(7)
  })
  it('does not change the cuts it was given', () => {
    const copy = JSON.stringify(cuts)
    moveCutIn(cuts, 0, 5)
    expect(JSON.stringify(cuts)).toBe(copy)
  })
  it('names the pieces that do not fit in plain words', () => {
    expect(misfitMessage([3])).toBe('Piece 3 is too big for your printer. Move the cuts or pick a bigger printer.')
    expect(misfitMessage([2, 3])).toBe('Pieces 2 and 3 are too big for your printer. Move the cuts or pick a bigger printer.')
    expect(misfitMessage([1, 2, 4])).toBe('Pieces 1, 2 and 4 are too big for your printer. Move the cuts or pick a bigger printer.')
    expect(misfitMessage([])).toBeNull()
  })
})
