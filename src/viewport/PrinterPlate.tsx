import { Grid, Line } from '@react-three/drei'
import type { Printer } from '../printers/printers'

const CELL_COLOR = '#c9d3e3'
const SECTION_COLOR = '#8fa3c2'
const PLATE_COLOR = '#dbe3ef'
const EDGE_COLOR = '#5b6f8f'
/** The plate sits a hair below the floor so parts standing on z = 0 never flicker into it. */
const PLATE_Z = -0.05

/** The chosen printer's plate with a grid on it, or the endless grid when there's no printer. Clicks pass through. */
export function PrinterPlate({ printer }: { printer: Printer | null }) {
  if (!printer) {
    return <Grid rotation={[Math.PI / 2, 0, 0]} cellSize={1} sectionSize={10} infiniteGrid fadeDistance={600}
      cellColor={CELL_COLOR} sectionColor={SECTION_COLOR} raycast={() => null} />
  }
  const [width, depth] = printer.size
  const [x, y] = [width / 2, depth / 2]
  return (
    <group>
      <mesh position={[0, 0, PLATE_Z]} raycast={() => null}>
        <planeGeometry args={[width, depth]} />
        <meshBasicMaterial color={PLATE_COLOR} />
      </mesh>
      <Grid rotation={[Math.PI / 2, 0, 0]} args={[width, depth]} cellSize={1} sectionSize={10} fadeDistance={600}
        cellColor={CELL_COLOR} sectionColor={SECTION_COLOR} raycast={() => null} />
      <Line points={[[-x, -y, 0], [x, -y, 0], [x, y, 0], [-x, y, 0], [-x, -y, 0]]} color={EDGE_COLOR} lineWidth={2}
        raycast={() => null} />
    </group>
  )
}
