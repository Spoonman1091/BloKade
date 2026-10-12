import { GizmoHelper, GizmoViewport, Grid, OrbitControls } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { useState } from 'react'
import { Object3D } from 'three'
import { nextSelection } from '../app/selection'
import type { NodeId, Vec3 } from '../document/types'
import type { PluginRegistry } from '../plugins/registry'
import { useBloKade } from '../store/context'
import { NodeMesh } from './NodeMesh'
import { TransformHandles } from './TransformHandles'
import { WorkplaneMarker } from './WorkplaneMarker'
import { workplaneFromHit } from './workplane'

// BloKade is Z-up like slicers. This must run before the camera is created.
Object3D.DEFAULT_UP.set(0, 0, 1)

export function Viewport({ registry }: { registry: PluginRegistry }) {
  const doc = useBloKade((s) => s.history.present)
  const meshes = useBloKade((s) => s.meshes)
  const selection = useBloKade((s) => s.selection)
  const engineReady = useBloKade((s) => s.engineReady)
  const select = useBloKade((s) => s.select)
  const picking = useBloKade((s) => s.pickingWorkplane)
  const workplane = useBloKade((s) => s.workplane)
  const setWorkplane = useBloKade((s) => s.setWorkplane)
  const [measurement, setMeasurement] = useState<string | null>(null)
  const onSelect = (id: NodeId, additive: boolean): void => select(nextSelection(selection, id, additive))
  const onPickFace = picking ? (point: Vec3, normal: Vec3): void => setWorkplane(workplaneFromHit(point, normal)) : undefined
  const onPointerMissed = (event: MouseEvent): void => {
    if (picking) setWorkplane(null)
    else if (!(event.shiftKey || event.metaKey || event.ctrlKey)) select([])
  }

  return (
    <>
      <Canvas camera={{ position: [120, -160, 120], fov: 45, near: 0.5, far: 5000 }} onPointerMissed={onPointerMissed}>
        <color attach="background" args={['#e9eef7']} />
        <ambientLight intensity={0.7} />
        <directionalLight position={[150, -100, 250]} intensity={1.6} />
        <directionalLight position={[-150, 100, 80]} intensity={0.5} />
        <Grid rotation={[Math.PI / 2, 0, 0]} cellSize={1} sectionSize={10} infiniteGrid fadeDistance={600} cellColor="#c9d3e3" sectionColor="#8fa3c2" />
        {doc.root.map((id) => {
          const node = doc.nodes[id]
          const displayed = meshes[id]
          return node && displayed && !node.hidden ? (
            <NodeMesh key={id} node={node} displayed={displayed} selected={selection.includes(id)} onSelect={onSelect} onPickFace={onPickFace} />
          ) : null
        })}
        {workplane && <WorkplaneMarker workplane={workplane} />}
        <TransformHandles registry={registry} onMeasure={setMeasurement} />
        <OrbitControls makeDefault />
        <GizmoHelper alignment="bottom-right" margin={[70, 70]}>
          <GizmoViewport />
        </GizmoHelper>
      </Canvas>
      {measurement && <div className="measure-overlay" data-testid="measurement">{measurement}</div>}
      {picking && <div className="viewport-hint" role="status">Click a face to build on it. Click empty space to build on the ground again.</div>}
      {!engineReady && <div className="viewport-overlay">Warming up the geometry engine…</div>}
    </>
  )
}
