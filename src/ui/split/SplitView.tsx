import { OrbitControls } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import { BufferAttribute, BufferGeometry, Object3D } from 'three'
import type { OpenedModel } from '../../split/split-api'
import type { Cut, GridPlan, PieceMesh, PiecesResult } from '../../split/types'
import { usePrinter } from '../../printers/printer-store'
import { PrinterPlate } from '../../viewport/PrinterPlate'

// Z-up like the design view; harmless to repeat.
Object3D.DEFAULT_UP.set(0, 0, 1)

const MODEL_COLOR = '#8aa4d6'
const MISFIT_COLOR = '#ff1a1a'
const CUT_COLOR = '#e02020'
const CUT_WIDTH = 0.6
/** Pieces are drawn this far apart (mm) so the cuts show. */
const SPREAD = 4

function useGeometry(vertices: Float32Array, triangles: Uint32Array): BufferGeometry {
  const geometry = useMemo(() => {
    const g = new BufferGeometry()
    g.setAttribute('position', new BufferAttribute(vertices, 3))
    g.setIndex(new BufferAttribute(triangles, 1))
    g.computeVertexNormals()
    return g
  }, [vertices, triangles])
  useEffect(() => () => geometry.dispose(), [geometry])
  return geometry
}

function Solid({ vertices, triangles, color, offset }: { vertices: Float32Array; triangles: Uint32Array; color: string; offset: readonly [number, number, number] }) {
  const geometry = useGeometry(vertices, triangles)
  return (
    <mesh geometry={geometry} position={[offset[0], offset[1], offset[2]]}>
      <meshStandardMaterial color={color} />
    </mesh>
  )
}

function spreadOf(piece: PieceMesh, grid: GridPlan): readonly [number, number, number] {
  const col = (piece.number - 1) % grid.cols
  const row = Math.floor((piece.number - 1) / grid.cols)
  return [(col - (grid.cols - 1) / 2) * SPREAD, (row - (grid.rows - 1) / 2) * SPREAD, 0]
}

/** A thin red upright quad where the cut is. */
function CutLine({ cut, width, depth, height }: { cut: Cut; width: number; depth: number; height: number }) {
  const along = cut.axis === 'x'
  return (
    <mesh position={along ? [cut.at, 0, height / 2] : [0, cut.at, height / 2]} raycast={() => null}>
      <boxGeometry args={along ? [CUT_WIDTH, depth, height] : [width, CUT_WIDTH, height]} />
      <meshBasicMaterial color={CUT_COLOR} transparent opacity={0.6} depthWrite={false} />
    </mesh>
  )
}

interface SplitViewProps {
  readonly info: OpenedModel | null
  readonly grid: GridPlan | null
  readonly result: PiecesResult | null
}

/** The model (or the finished pieces, spread a little apart) on the printer's plate, with the cuts as red lines. */
export function SplitView({ info, grid, result }: SplitViewProps) {
  const printer = usePrinter()
  const [width, depth, height] = info?.size ?? [0, 0, 0]
  return (
    <Canvas camera={{ position: [120, -160, 120], fov: 45, near: 0.5, far: 5000 }}>
      <color attach="background" args={['#e9eef7']} />
      <ambientLight intensity={0.7} />
      <directionalLight position={[150, -100, 250]} intensity={1.6} />
      <PrinterPlate printer={printer} />
      {info && grid && result
        ? result.pieces.map((piece) => (
          <Solid key={piece.number} vertices={piece.vertices} triangles={piece.triangles} offset={spreadOf(piece, grid)}
            color={piece.fits ? MODEL_COLOR : MISFIT_COLOR} />
        ))
        : info && <Solid vertices={info.preview.vertices} triangles={info.preview.triangles} offset={[0, 0, 0]} color={MODEL_COLOR} />}
      {info && grid && !result && grid.cuts.map((cut, i) => <CutLine key={i} cut={cut} width={width} depth={depth} height={height} />)}
      <OrbitControls makeDefault />
    </Canvas>
  )
}
