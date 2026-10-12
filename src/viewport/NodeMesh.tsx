import type { ThreeEvent } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import { MathUtils } from 'three'
import { HOLE_COLOR } from '../document/factory'
import type { NodeId, SceneNode, Vec3 } from '../document/types'
import type { DisplayedMesh } from '../store/merge-build'
import { pickFromIntersections } from './workplane'
import { toBufferGeometry, toEdgeGeometry } from './three-geometry'

const EDGE_COLOR = '#2b3445'
const SELECTED_EDGE_COLOR = '#ff8a00'

interface NodeMeshProps {
  node: SceneNode
  displayed: DisplayedMesh
  selected: boolean
  onSelect(id: NodeId, additive: boolean): void
  /** Set while choosing a workplane: clicking a face reports it instead of selecting the part. */
  onPickFace?(point: Vec3, normal: Vec3): void
}

export function NodeMesh({ node, displayed, selected, onSelect, onPickFace }: NodeMeshProps) {
  const geometry = useMemo(() => toBufferGeometry(displayed.mesh), [displayed.mesh])
  const edges = useMemo(() => toEdgeGeometry(displayed.mesh), [displayed.mesh])
  useEffect(() => () => {
    geometry.dispose()
    edges.dispose()
  }, [geometry, edges])

  const [x, y, z] = node.transform.position
  const [rx, ry, rz] = node.transform.rotation
  const isHole = node.mode === 'hole'
  const opacity = isHole ? 0.35 : displayed.stale ? 0.5 : 1
  const handleClick = (event: ThreeEvent<MouseEvent>): void => {
    event.stopPropagation()
    if (onPickFace) {
      const picked = pickFromIntersections(event.intersections)
      if (picked) onPickFace(picked.point, picked.normal)
      return
    }
    onSelect(node.id, event.shiftKey || event.metaKey || event.ctrlKey)
  }

  return (
    <group
      name={node.id}
      position={[x, y, z]}
      rotation={[MathUtils.degToRad(rx), MathUtils.degToRad(ry), MathUtils.degToRad(rz)]}
      onClick={handleClick}
    >
      <mesh geometry={geometry}>
        {/* three.js bakes transparency into the shader at compile time, so a new key rebuilds the material when it flips */}
        <meshStandardMaterial
          key={opacity < 1 ? 'transparent' : 'opaque'}
          color={isHole ? HOLE_COLOR : node.color}
          transparent={opacity < 1}
          opacity={opacity}
          depthWrite={!isHole}
          polygonOffset
          polygonOffsetFactor={1}
          polygonOffsetUnits={1}
          emissive={selected ? SELECTED_EDGE_COLOR : '#000000'}
          emissiveIntensity={selected ? 0.25 : 0}
        />
      </mesh>
      <lineSegments geometry={edges} raycast={() => null}>
        <lineBasicMaterial color={selected ? SELECTED_EDGE_COLOR : EDGE_COLOR} />
      </lineSegments>
    </group>
  )
}
