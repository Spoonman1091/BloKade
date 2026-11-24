import { Grid, Line } from '@react-three/drei'
import type { Printer } from '../printers/printers'
import { useSceneColors } from './scene-colors'

/** The plate sits a hair below the floor so parts standing on z = 0 never flicker into it. */
const PLATE_Z = -0.05

/** The chosen printer's plate with a grid on it, or the endless grid when there's no printer. Clicks pass through. */
export function PrinterPlate({ printer }: { printer: Printer | null }) {
  const colors = useSceneColors()
  if (!printer) {
    return <Grid rotation={[Math.PI / 2, 0, 0]} cellSize={1} sectionSize={10} infiniteGrid fadeDistance={600}
      cellColor={colors.gridCell} sectionColor={colors.gridSection} raycast={() => null} />
  }
  const [width, depth] = printer.size
  const [x, y] = [width / 2, depth / 2]
  return (
    <group>
      <mesh position={[0, 0, PLATE_Z]} raycast={() => null}>
        <planeGeometry args={[width, depth]} />
        <meshBasicMaterial color={colors.plate} />
      </mesh>
      <Grid rotation={[Math.PI / 2, 0, 0]} args={[width, depth]} cellSize={1} sectionSize={10} fadeDistance={600}
        cellColor={colors.gridCell} sectionColor={colors.gridSection} raycast={() => null} />
      <Line points={[[-x, -y, 0], [x, -y, 0], [x, y, 0], [-x, y, 0], [-x, -y, 0]]} color={colors.plateEdge} lineWidth={2}
        raycast={() => null} />
    </group>
  )
}
