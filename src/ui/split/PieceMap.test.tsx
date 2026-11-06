// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import type { GridPlan, PiecesResult } from '../../split/types'
import { PieceMap } from './PieceMap'
import { piece } from './testing/fake-split-client'

afterEach(cleanup)

const GRID: GridPlan = { cols: 2, rows: 2, cuts: [{ axis: 'x', min: -10, max: 10, at: 0 }, { axis: 'y', min: -10, max: 10, at: 0 }] }

const label = (n: number): SVGTextElement => within(screen.getByTestId('split-map')).getByText(String(n)) as unknown as SVGTextElement
const at = (n: number): [number, number] => [Number(label(n).getAttribute('x')), Number(label(n).getAttribute('y'))]

describe('PieceMap', () => {
  it('draws each piece in its own cell when a cell is empty', () => {
    // The front-right cell (1) holds nothing, so the pieces are numbered 1, 2, 3 over cells 0, 2, 3.
    const result: PiecesResult = { pieces: [piece(1, true, 0), piece(2, true, 2), piece(3, true, 3)], glueCuts: [], glueSegments: [] }
    render(<PieceMap size={[200, 100, 10]} grid={GRID} result={result} />)
    const [x1, y1] = at(1)
    const [x2, y2] = at(2)
    const [x3, y3] = at(3)
    expect(x2).toBe(x1) // piece 2 is back-left, above piece 1
    expect(y2).toBeLessThan(y1)
    expect(x3).toBeGreaterThan(x2) // piece 3 is back-right
    expect(y3).toBe(y2)
  })
  it('puts "glue here" on the unjoined stretch of a cut only (R18)', () => {
    const four = [1, 2, 3, 4].map((n) => piece(n))
    // Only the front half (y −50 … 0) of the x cut needs glue.
    const result: PiecesResult = { pieces: four, glueCuts: [0], glueSegments: [{ cut: 0, from: -50, to: 0 }] }
    render(<PieceMap size={[200, 100, 10]} grid={GRID} result={result} />)
    const glue = within(screen.getByTestId('split-map')).getAllByText('glue here')
    expect(glue).toHaveLength(1)
    const y = Number(glue[0]!.getAttribute('y'))
    const [, frontY] = at(1)
    const [, backY] = at(3)
    expect(Math.abs(y - frontY)).toBeLessThan(Math.abs(y - backY))
  })
})
