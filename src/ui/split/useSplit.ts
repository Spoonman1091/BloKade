import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { downloadBytes } from '../../app/download'
import type { ImportUnit } from '../../app/import-stl'
import { MAX_STL_BYTES, NOT_STL, TOO_BIG_FILE } from '../../import/limits'
import { usePrinter } from '../../printers/printer-store'
import { DEFAULT_FIT_GAP, NO_BASE_MESSAGE, NO_PRINTER_MESSAGE, THIN_TONGUE_MESSAGE, TONGUE_MIN_BASE, UNEXPECTED_MESSAGE } from '../../split/constants'
import { baseName } from '../../split/save'
import type { OpenedModel } from '../../split/split-api'
import { SplitCancelled, type SplitClient } from '../../split/split-client'
import type { Cut, GridPlan, PiecesResult, Plate, SplitResult, SplitSettings } from '../../split/types'
import { JOINT_RESERVE, misfitCells } from '../../split/grid'
import { effectiveSettings, liveMisfitMessage, misfitMessage, moveCutIn, normalizeSettings } from './split-rules'

export type Stage = 'empty' | 'opened' | 'planned' | 'pieces'
export type Busy = 'opening' | 'planning' | 'making' | 'saving' | null
export interface Progress { readonly done: number; readonly total: number }

interface State {
  readonly stage: Stage
  readonly info: OpenedModel | null
  readonly fileName: string | null
  readonly unit: ImportUnit
  readonly openId: number
  readonly grid: GridPlan | null
  /** Whether planning found a flat base. null until the first plan of this file. */
  readonly hasBase: boolean | null
  readonly settings: SplitSettings
  readonly pieces: PiecesResult | null
  readonly busy: Busy
  readonly progress: Progress | null
  readonly error: string | null
}

const START_SETTINGS: SplitSettings = { joint: 'tabs', fitGap: DEFAULT_FIT_GAP, numbers: true, baseThickness: null }
const START: State = {
  stage: 'empty', info: null, fileName: null, unit: 'mm', openId: 0, grid: null, hasBase: null,
  settings: START_SETTINGS, pieces: null, busy: null, progress: null, error: null,
}

/** The pieces are out of date as soon as a setting or a cut changes. */
const stale = (s: State): State => (s.stage === 'pieces' ? { ...s, stage: 'planned', pieces: null } : s)
/** The grid cells whose piece would be too big with these cuts, for the joint style in use. */
function plannedMisfits(grid: GridPlan, s: State, plate: Plate): number[] {
  const [width, depth] = s.info?.size ?? [0, 0]
  const reserve = JOINT_RESERVE[effectiveSettings(s.settings, s.hasBase).joint]
  return misfitCells(grid, { width, depth }, plate, reserve)
}

/** No plan (it failed or was cancelled): back to just opened, so "Work out the pieces" shows. */
const unplanned = (s: State): State => ({ ...s, stage: 'opened', grid: null, pieces: null })

export interface Split extends State {
  readonly plate: Plate | null
  /** The joint style and base in use (no flat base means no joints). */
  readonly shown: SplitSettings
  readonly misfits: readonly number[]
  readonly messages: readonly string[]
  readonly message: string | null
  readonly canMake: boolean
  readonly canSave: boolean
  open(file: File, unit?: ImportUnit): Promise<void>
  changeUnit(unit: ImportUnit): void
  replan(): void
  setSetting<K extends keyof SplitSettings>(key: K, value: SplitSettings[K]): void
  moveCut(index: number, at: number): void
  makePieces(): Promise<void>
  save(): Promise<void>
  cancel(): void
}

/** A call's value, when it answered and is still the latest call; null otherwise. */
type Answer<T> = { readonly value: T } | null

const plateOf = (size: readonly number[] | undefined): Plate | null => (size ? { width: size[0] ?? 0, depth: size[1] ?? 0 } : null)

/** The Split for printing screen's state and actions. All heavy work goes through `client`. */
export function useSplit(client: SplitClient): Split {
  const printer = usePrinter()
  const plate = useMemo(() => plateOf(printer?.size), [printer])
  const [state, setState] = useState<State>(START)
  const kept = useRef<{ name: string; bytes: ArrayBuffer } | null>(null)
  const latest = useRef({ state, plate })
  /** Each call takes a number; an answer from an older call is ignored. */
  const sequence = useRef(0)
  useEffect(() => { latest.current = { state, plate } })
  useEffect(() => client.onProgress((done, total) => setState((s) => (s.busy === 'making' ? { ...s, progress: { done, total } } : s))), [client])

  const shown = useMemo(() => effectiveSettings(state.settings, state.hasBase), [state.settings, state.hasBase])

  /**
   * Runs one worker call. Cancel is not an error: it just ends the wait and `cancelled` restores the screen.
   * Cancel starts a fresh worker that holds no pieces, so every `cancelled` drops them.
   */
  const run = useCallback(async <T,>(busy: Exclude<Busy, null>, call: () => Promise<SplitResult<T>>, done: (value: T) => (s: State) => State,
    failed: (message: string) => (s: State) => State, cancelled: (s: State) => State): Promise<Answer<T>> => {
    const mine = ++sequence.current
    setState((s) => ({ ...s, busy, progress: null, error: null }))
    const finish = (change: (s: State) => State): boolean => {
      if (mine !== sequence.current) return false
      setState((s) => ({ ...change(s), busy: null, progress: null }))
      return true
    }
    try {
      const result = await call()
      const current = finish(result.ok ? done(result.value) : failed(result.message))
      return current && result.ok ? { value: result.value } : null
    } catch (error) {
      if (error instanceof SplitCancelled) { finish(cancelled); return null }
      console.error('Split for printing screen failed:', error)
      finish(failed(UNEXPECTED_MESSAGE))
      return null
    }
  }, [])

  const openKept = useCallback(async (unit: ImportUnit): Promise<void> => {
    const file = kept.current
    if (!file) return
    setState((s) => ({ ...START, settings: { ...s.settings, baseThickness: null }, unit, fileName: file.name, openId: s.openId + 1 }))
    await run('opening', () => client.open(file.bytes, unit),
      (info) => (s) => ({ ...s, info, stage: 'opened' }),
      (message) => (s) => ({ ...s, stage: 'empty', error: message }),
      (s) => ({ ...s, stage: 'empty' }))
  }, [client, run])

  const open = useCallback(async (file: File, unit?: ImportUnit): Promise<void> => {
    if (file.size > MAX_STL_BYTES) return setState((s) => ({ ...s, error: TOO_BIG_FILE }))
    let bytes: ArrayBuffer
    try { bytes = await file.arrayBuffer() } catch { return setState((s) => ({ ...s, error: NOT_STL })) }
    kept.current = { name: file.name, bytes }
    await openKept(unit ?? latest.current.state.unit)
  }, [openKept])

  const changeUnit = useCallback((unit: ImportUnit): void => {
    if (kept.current) void openKept(unit)
    else setState((s) => ({ ...s, unit }))
  }, [openKept])

  const runPlan = useCallback(async (): Promise<void> => {
    const { state: s, plate: p } = latest.current
    if (!s.info || !p) return
    const sent = effectiveSettings(s.settings, s.hasBase)
    await run('planning', () => client.plan(p, sent),
      ({ grid, baseThickness }) => (cur) => {
        const first = cur.hasBase === null
        const settings = first ? normalizeSettings({ ...cur.settings, baseThickness }) : cur.settings
        return { ...cur, grid, hasBase: baseThickness !== null, settings, stage: 'planned', pieces: null }
      },
      (message) => (cur) => ({ ...unplanned(cur), error: message }),
      unplanned)
  }, [client, run])

  // Plan on its own once a file is open, and again when the joint style or the printer changes (they change the reserve).
  const planKey = state.info && plate ? `${state.openId}|${shown.joint}|${plate.width}x${plate.depth}` : null
  useEffect(() => { if (planKey) void runPlan() }, [planKey, runPlan])

  const setSetting = useCallback(<K extends keyof SplitSettings>(key: K, value: SplitSettings[K]): void => {
    setState((s) => stale({ ...s, settings: normalizeSettings({ ...s.settings, [key]: value }) }))
  }, [])

  const moveCut = useCallback((index: number, at: number): void => {
    const p = latest.current.plate
    setState((s) => {
      if (!s.grid) return s
      const grid = s.grid
      const fits = (moved: readonly Cut[]): boolean => !p || !s.info || plannedMisfits({ ...grid, cuts: moved }, s, p).length === 0
      const cuts = moveCutIn(grid.cuts, index, at, fits)
      if (cuts[index]?.at === s.grid.cuts[index]?.at) return s
      return stale({ ...s, grid: { ...s.grid, cuts } })
    })
  }, [])

  const makePieces = useCallback(async (): Promise<void> => {
    const { state: s, plate: p } = latest.current
    if (!s.grid || !p || s.busy) return
    const { grid } = s
    await run('making', () => client.pieces(grid, effectiveSettings(s.settings, s.hasBase), p),
      (pieces) => (cur) => ({ ...cur, pieces, stage: 'pieces' }),
      (message) => (cur) => ({ ...stale(cur), error: message }),
      stale)
  }, [client, run])

  const save = useCallback(async (): Promise<void> => {
    const { state: s } = latest.current
    if (s.stage !== 'pieces' || s.busy) return
    const name = baseName(s.fileName ?? '')
    const answer = await run('saving', () => client.save(name),
      () => (cur) => cur,
      (message) => (cur) => ({ ...cur, error: message }),
      stale)
    // Outside any state updater: React may run an updater twice.
    if (answer) downloadBytes(answer.value as BlobPart, `${name}-pieces.zip`, 'application/zip')
  }, [client, run])

  const cancel = useCallback((): void => client.cancel(), [client])

  const misfits = useMemo(() => (state.pieces?.pieces ?? []).filter((p) => !p.fits).map((p) => p.number), [state.pieces])
  // Live, before Make: how many pieces the current cuts would make too big.
  const liveMisfits = useMemo(
    () => (state.grid && state.info && plate && !state.pieces ? plannedMisfits(state.grid, state, plate).length : 0),
    [state, plate],
  )
  const messages = useMemo(() => {
    const base = state.settings.baseThickness
    return [
      state.error,
      plate ? null : NO_PRINTER_MESSAGE,
      state.hasBase === false ? NO_BASE_MESSAGE : null,
      state.hasBase && base !== null && base < TONGUE_MIN_BASE ? THIN_TONGUE_MESSAGE : null,
      misfitMessage(misfits),
      liveMisfitMessage(liveMisfits),
    ].filter((m): m is string => m !== null)
  }, [state.error, state.hasBase, state.settings.baseThickness, plate, misfits, liveMisfits])

  const idle = state.busy === null
  return {
    ...state, plate, shown, misfits, messages, message: messages.length > 0 ? messages.join(' ') : null,
    canMake: idle && plate !== null && state.grid !== null,
    canSave: idle && state.stage === 'pieces' && misfits.length === 0,
    open, changeUnit, replan: () => void runPlan(), setSetting, moveCut, makePieces, save, cancel,
  }
}
