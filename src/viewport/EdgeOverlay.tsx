import { Line } from '@react-three/drei'
import type { ThreeEvent } from '@react-three/fiber'
import { useMemo } from 'react'
import { worldMatrix } from '../document/transform-math'
import type { EdgeFingerprint } from '../document/types'
import { useBloKade } from '../store/context'
import { edgeHitTolerance, isEdgeHitVisible, pointsOf } from './edge-points'

const PICKED = '#ff8a00'
const CANDIDATE = '#2f80ed'

interface HitObject {
  readonly isMesh?: boolean
  readonly isLineSegments2?: boolean
  readonly material?: { readonly transparent?: boolean }
}

/** How far away the click hit solid part faces (not edge lines, not see-through holes). */
function faceHitDistances(event: ThreeEvent<MouseEvent>): number[] {
  return event.intersections.flatMap((hit) => {
    const object = hit.object as HitObject
    const solidFace = object.isMesh === true && object.isLineSegments2 !== true && object.material?.transparent !== true
    return solidFace ? [hit.distance] : []
  })
}

/** Did the click land on this edge where Kade can see it, rather than through a face in front? */
function clickedVisibly(event: ThreeEvent<MouseEvent>): boolean {
  return isEdgeHitVisible(event.distance, faceHitDistances(event), edgeHitTolerance(event.distance))
}

/** While picking edges: every edge of the part as a thick line; clicking one adds or removes it. */
export function EdgeOverlay({ onToggle }: { onToggle(fingerprint: EdgeFingerprint): void }) {
  const picking = useBloKade((s) => s.pickingEdges)
  const candidates = useBloKade((s) => s.edgeCandidates)
  const doc = useBloKade((s) => s.history.present)
  const matrix = useMemo(
    () => (picking && Object.hasOwn(doc.nodes, picking.nodeId) ? worldMatrix(doc, picking.nodeId) : null),
    [doc, picking],
  )
  if (!picking || !candidates || !matrix) return null
  return (
    <group matrix={matrix} matrixAutoUpdate={false}>
      {candidates.map((c, i) => (
        <Line key={i} points={pointsOf(c.points)} color={c.picked ? PICKED : CANDIDATE} lineWidth={c.picked ? 6 : 4}
          onClick={(event: ThreeEvent<MouseEvent>) => {
            event.stopPropagation()
            if (clickedVisibly(event)) onToggle(c.fingerprint)
          }} />
      ))}
    </group>
  )
}
