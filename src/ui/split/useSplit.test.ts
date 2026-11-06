// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { downloadBytes } from '../../app/download'
import { printerStore } from '../../printers/printer-store'
import { DEFAULT_PRINTER } from '../../printers/printers'
import { THIN_TONGUE_MESSAGE } from '../../split/constants'
import type { Cut, GridPlan } from '../../split/types'
import { planGrid, misfitCells } from '../../split/grid'
import { liveMisfitMessage, moveCutIn, misfitMessage } from './split-rules'
import { GRID } from './testing/fake-split-client'
import { fakeSplitClient } from './testing/fake-split-client'
import { useSplit } from './useSplit'

vi.mock('../../app/download', () => ({ downloadBytes: vi.fn() }))
afterEach(() => { cleanup(); printerStore.getState().setPrinter(DEFAULT_PRINTER); vi.clearAllMocks() })

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
    expect(hook.result.current.grid?.cuts[0]?.at).toBe(33)
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

  it('drops the pieces when Make again is cancelled, so Save is off', async () => {
    const { hook, settings } = await planned()
    await act(async () => { await hook.result.current.makePieces() })
    expect(hook.result.current.canSave).toBe(true)
    settings.hangPieces = true
    let made: Promise<void> | undefined
    act(() => { made = hook.result.current.makePieces() })
    await waitFor(() => expect(hook.result.current.busy).toBe('making'))
    act(() => hook.result.current.cancel())
    await act(async () => { await made })
    expect(hook.result.current.stage).toBe('planned')
    expect(hook.result.current.pieces).toBeNull()
    expect(hook.result.current.canSave).toBe(false)
  })

  it('drops the pieces when Save is cancelled (the fresh worker has none)', async () => {
    const { hook, settings } = await planned()
    await act(async () => { await hook.result.current.makePieces() })
    settings.hangSave = true
    let saved: Promise<void> | undefined
    act(() => { saved = hook.result.current.save() })
    await waitFor(() => expect(hook.result.current.busy).toBe('saving'))
    act(() => hook.result.current.cancel())
    await act(async () => { await saved })
    expect(hook.result.current.stage).toBe('planned')
    expect(hook.result.current.canSave).toBe(false)
  })

  it('goes back to "opened" with no grid when a new plan is cancelled', async () => {
    const { hook, settings } = await planned()
    await act(async () => { await hook.result.current.makePieces() })
    settings.hangPlan = true
    act(() => hook.result.current.replan())
    await waitFor(() => expect(hook.result.current.busy).toBe('planning'))
    act(() => hook.result.current.cancel())
    await waitFor(() => expect(hook.result.current.busy).toBeNull())
    expect(hook.result.current.stage).toBe('opened')
    expect(hook.result.current.grid).toBeNull()
    expect(hook.result.current.pieces).toBeNull()
    expect(hook.result.current.canSave).toBe(false)
  })

  it('downloads the ZIP once, even in StrictMode', async () => {
    const fake = fakeSplitClient()
    const hook = renderHook(() => useSplit(fake.client), { reactStrictMode: true })
    await act(async () => { await hook.result.current.open(file(), 'mm') })
    await waitFor(() => expect(hook.result.current.stage).toBe('planned'))
    await act(async () => { await hook.result.current.makePieces() })
    await act(async () => { await hook.result.current.save() })
    expect(downloadBytes).toHaveBeenCalledTimes(1)
    expect(downloadBytes).toHaveBeenCalledWith(expect.any(Uint8Array), 'a-pieces.zip', 'application/zip')
  })

  it('says live, before Make, when the cuts would make a piece too big (R19)', async () => {
    const tooFar: GridPlan = { ...GRID, cuts: GRID.cuts.map((c, i) => (i === 0 ? { ...c, max: 60, at: 50 } : c)) }
    const { hook } = await planned({ grid: tooFar })
    expect(hook.result.current.messages).toContain(liveMisfitMessage(2))
    act(() => hook.result.current.moveCut(0, 0))
    expect(hook.result.current.messages).toEqual([])
  })

  it('will not move a cut so a piece stops fitting (R19)', async () => {
    const wide: GridPlan = { ...GRID, cuts: GRID.cuts.map((c, i) => (i === 0 ? { ...c, min: -60, max: 60 } : c)) }
    const { hook } = await planned({ grid: wide })
    act(() => hook.result.current.moveCut(0, 50))
    expect(hook.result.current.grid?.cuts[0]?.at).toBe(0)
    act(() => hook.result.current.moveCut(0, 30))
    expect(hook.result.current.grid?.cuts[0]?.at).toBe(30)
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
  it('refuses to move a cut so a piece would be too big: 3 cuts on a 500 mm strip (R19)', () => {
    const plate = { width: 180, depth: 180 }
    const size = { width: 500, depth: 100 }
    const plan = planGrid(500, 100, plate, 10)!
    const fits = (moved: readonly Cut[]): boolean => misfitCells({ ...plan, cuts: moved }, size, plate, 10).length === 0
    const first = moveCutIn(plan.cuts, 0, -150, fits)
    expect(first[0]?.at).toBe(-150)
    // Cut 2 to 25 would make piece 2 195 mm long: the move is refused.
    const second = moveCutIn(first, 1, 25, fits)
    expect(second[1]?.at).toBe(0)
    expect(fits(second)).toBe(true)
  })
  it('says how many pieces would not fit', () => {
    expect(liveMisfitMessage(0)).toBeNull()
    expect(liveMisfitMessage(1)).toBe('One piece would be too big for your printer. Move the cuts or pick a bigger printer.')
    expect(liveMisfitMessage(3)).toBe('3 pieces would be too big for your printer. Move the cuts or pick a bigger printer.')
  })
})
