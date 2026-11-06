import type { Cut, GridPlan, PiecesResult } from '../../split/types'
import type { Vec3 } from '../../document/types'

const PAD = 6
const MISFIT_FILL = '#ffd6d6'
const FIT_FILL = '#e3ecfb'
const GLUE_COLOR = '#b3261e'

/** The cut positions on one axis, with the model's two ends, smallest first: the edges of the map's cells. */
function edges(cuts: readonly Cut[], axis: Cut['axis'], length: number): readonly number[] {
  const at = cuts.filter((c) => c.axis === axis).map((c) => c.at).sort((a, b) => a - b)
  return [-length / 2, ...at, length / 2]
}

interface PieceMapProps {
  readonly size: Vec3
  readonly grid: GridPlan
  readonly result: PiecesResult
}

/** The grid from above with each piece's number. The front of the model (−y) is at the bottom. Stretches that need glue are marked. */
export function PieceMap({ size, grid, result }: PieceMapProps) {
  const [width, depth] = size
  const xs = edges(grid.cuts, 'x', width)
  const ys = edges(grid.cuts, 'y', depth)
  const labelSize = Math.max(8, Math.min(width, depth) / 10)
  const glueSize = labelSize / 2.5
  const top = (y: number): number => depth / 2 - y + PAD
  const left = (x: number): number => x + width / 2 + PAD
  return (
    <svg className="split-map" data-testid="split-map" role="img" aria-label="Map of the pieces"
      viewBox={`0 0 ${width + PAD * 2} ${depth + PAD * 2}`}>
      {result.pieces.map((piece) => {
        const col = piece.cell % grid.cols
        const row = Math.floor(piece.cell / grid.cols)
        const [x0, x1, y0, y1] = [xs[col] ?? 0, xs[col + 1] ?? 0, ys[row] ?? 0, ys[row + 1] ?? 0]
        return (
          <g key={piece.number}>
            <rect x={left(x0)} y={top(y1)} width={x1 - x0} height={y1 - y0} fill={piece.fits ? FIT_FILL : MISFIT_FILL}
              stroke="#5b6f8f" strokeWidth={0.6} />
            <text x={left((x0 + x1) / 2)} y={top((y0 + y1) / 2)} fontSize={labelSize} textAnchor="middle" dominantBaseline="central"
              fill={piece.fits ? '#1c2a44' : '#b3261e'}>{piece.number}</text>
          </g>
        )
      })}
      {result.glueSegments.map((glue) => {
        const cut = grid.cuts[glue.cut]
        if (!cut) return null
        const vertical = cut.axis === 'x'
        const middle = (glue.from + glue.to) / 2
        const [x, y] = vertical ? [left(cut.at), top(middle)] : [left(middle), top(cut.at)]
        const [ax, ay, bx, by] = vertical
          ? [left(cut.at), top(glue.from), left(cut.at), top(glue.to)]
          : [left(glue.from), top(cut.at), left(glue.to), top(cut.at)]
        return (
          <g key={`${glue.cut}:${glue.from}`}>
            <line x1={ax} y1={ay} x2={bx} y2={by} stroke={GLUE_COLOR} strokeWidth={1.2} strokeDasharray="3 2" />
            <text className="split-map-glue" fontSize={glueSize} textAnchor="middle" fill={GLUE_COLOR} x={x} y={y - 1}
              transform={vertical ? `rotate(-90 ${x} ${y})` : undefined}>glue here</text>
          </g>
        )
      })}
    </svg>
  )
}
