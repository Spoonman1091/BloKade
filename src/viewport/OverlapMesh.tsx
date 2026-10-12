import { useEffect, useMemo } from 'react'
import { useBloKade } from '../store/context'
import { visibleOverlap } from '../store/overlap'
import { toBufferGeometry } from './three-geometry'
import type { MeshData } from '../geometry/types'

const OVERLAP_COLOR = '#ff2d2d'

function RedShape({ mesh }: { mesh: MeshData }) {
  const geometry = useMemo(() => toBufferGeometry(mesh), [mesh])
  useEffect(() => () => geometry.dispose(), [geometry])
  return (
    <mesh geometry={geometry} renderOrder={10} raycast={() => null}>
      <meshBasicMaterial color={OVERLAP_COLOR} transparent opacity={0.6} depthTest={false} />
    </mesh>
  )
}

/** Where the two checked parts run into each other, drawn in red on top of everything. World coordinates. */
export function OverlapMesh() {
  const overlap = useBloKade((s) => s.overlap)
  const present = useBloKade((s) => s.history.present)
  const selection = useBloKade((s) => s.selection)
  const result = visibleOverlap({ overlap, present, selection })
  return result?.status === 'overlap' ? <RedShape mesh={result.mesh} /> : null
}
