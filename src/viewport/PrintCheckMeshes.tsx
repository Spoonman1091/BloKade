import { useEffect, useMemo } from 'react'
import { FLOATING_COLOR, OVERHANG_COLOR, THIN_COLOR } from '../printers/print-colors'
import { useBloKade } from '../store/context'
import { visiblePrintCheck } from '../store/print-check'
import { toBufferGeometry } from './three-geometry'
import type { MeshData } from '../geometry/types'

function Highlight({ mesh, color }: { mesh: MeshData; color: string }) {
  const geometry = useMemo(() => toBufferGeometry(mesh), [mesh])
  useEffect(() => () => geometry.dispose(), [geometry])
  return (
    <mesh geometry={geometry} renderOrder={10} raycast={() => null}>
      <meshBasicMaterial color={color} transparent opacity={0.6} depthTest={false} />
    </mesh>
  )
}

/** Floating pieces (purple), thin walls (yellow) and overhangs (orange) from Check print, drawn over the parts. World coordinates. */
export function PrintCheckMeshes() {
  const view = useBloKade((s) => s.printCheck)
  const present = useBloKade((s) => s.history.present)
  const result = visiblePrintCheck(view, present)
  if (result?.status !== 'checked') return null
  return (
    <>
      {result.floating && <Highlight mesh={result.floating.mesh} color={FLOATING_COLOR} />}
      {result.thin && <Highlight mesh={result.thin.mesh} color={THIN_COLOR} />}
      {result.overhang && <Highlight mesh={result.overhang.mesh} color={OVERHANG_COLOR} />}
    </>
  )
}
