import { Grid } from '@react-three/drei'
import { MathUtils } from 'three'
import type { Workplane } from '../store/store'

/** An orange grid showing where new shapes will land. It ignores clicks so faces behind it can still be picked. */
export function WorkplaneMarker({ workplane }: { workplane: Workplane }) {
  const [x, y, z] = workplane.origin
  const [rx, ry, rz] = workplane.rotation
  return (
    <group position={[x, y, z]} rotation={[MathUtils.degToRad(rx), MathUtils.degToRad(ry), MathUtils.degToRad(rz)]}>
      <Grid position={[0, 0, 0.05]} rotation={[Math.PI / 2, 0, 0]} args={[60, 60]} cellSize={1} sectionSize={10}
        cellColor="#ffb766" sectionColor="#ff8a00" fadeDistance={250} raycast={() => null} />
    </group>
  )
}
