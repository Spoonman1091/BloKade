import { OrbitControls } from '@react-three/drei'
import { Canvas, useThree } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import { BufferAttribute, BufferGeometry, DoubleSide, Object3D, PerspectiveCamera } from 'three'
import type { OpenedModel } from '../../split/split-api'
import type { Cut, GridPlan, PieceMesh, PiecesResult } from '../../split/types'
import { usePrinter } from '../../printers/printer-store'
import { PrinterPlate } from '../../viewport/PrinterPlate'
import { cameraFit, type Footprint } from './camera-fit'

// Z-up like the design view; harmless to repeat.
Object3D.DEFAULT_UP.set(0, 0, 1)

const MODEL_COLOR = '#8aa4d6'
const MISFIT_COLOR = '#ff1a1a'
const CUT_COLOR = '#e02020'
/** How wide the cut line is drawn, mm. */
const CUT_WIDTH = 1.5
/** The cut line floats this far over the model's top, mm, so it never flickers into it. */
const CUT_LIFT = 0.05
const FOV = 45
/** Pieces are drawn this far apart (mm) so the cuts show. */
const SPREAD = 4

function useGeometry(vertices: Float32Array, triangles: Uint32Array): BufferGeometry {
  const geometry = useMemo(() => {
    const g = new BufferGeometry()
    g.setAttribute('position', new BufferAttribute(vertices, 3))
    g.setIndex(new BufferAttribute(triangles, 1))
    return g
  }, [vertices, triangles])
  useEffect(() => () => geometry.dispose(), [geometry])
  return geometry
}

function Solid({ vertices, triangles, color, offset }: { vertices: Float32Array; triangles: Uint32Array; color: string; offset: readonly [number, number, number] }) {
  const geometry = useGeometry(vertices, triangles)
  return (
    <mesh geometry={geometry} position={[offset[0], offset[1], offset[2]]}>
      {/* Flat shading needs no normals: sharp edges, and no main-thread work on a big mesh. */}
      <meshStandardMaterial color={color} flatShading />
    </mesh>
  )
}

function spreadOf(piece: PieceMesh, grid: GridPlan): readonly [number, number, number] {
  const col = piece.cell % grid.cols
  const row = Math.floor(piece.cell / grid.cols)
  return [(col - (grid.cols - 1) / 2) * SPREAD, (row - (grid.rows - 1) / 2) * SPREAD, 0]
}

/** A thin flat red strip just above the model's top, where the cut is. */
function CutLine({ cut, width, depth, height }: { cut: Cut; width: number; depth: number; height: number }) {
  const along = cut.axis === 'x'
  const z = height + CUT_LIFT
  return (
    <mesh position={along ? [cut.at, 0, z] : [0, cut.at, z]} raycast={() => null}>
      <planeGeometry args={along ? [CUT_WIDTH, depth] : [width, CUT_WIDTH]} />
      <meshBasicMaterial color={CUT_COLOR} side={DoubleSide} />
    </mesh>
  )
}

interface Controls { readonly target: { set(x: number, y: number, z: number): unknown }; update(): unknown }

/** Points the camera so the whole model and the whole plate are in view, each time either changes. */
function FitCamera({ model, plate }: { model: Footprint | null; plate: Footprint | null }) {
  const camera = useThree((s) => s.camera)
  const controls = useThree((s) => s.controls) as unknown as Controls | null
  const getSize = useThree((s) => s.get)
  const [mw, md, pw, pd] = [model?.width ?? 0, model?.depth ?? 0, plate?.width ?? 0, plate?.depth ?? 0]
  useEffect(() => {
    const { width, height } = getSize().size
    const fov = camera instanceof PerspectiveCamera ? camera.fov : FOV
    const fit = cameraFit(mw || md ? { width: mw, depth: md } : null, pw || pd ? { width: pw, depth: pd } : null, fov, width / Math.max(height, 1))
    camera.position.set(...fit.position)
    camera.lookAt(...fit.target)
    controls?.target.set(...fit.target)
    controls?.update()
  }, [camera, controls, getSize, mw, md, pw, pd])
  return null
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
  const [plateWidth, plateDepth] = printer?.size ?? [0, 0]
  return (
    <Canvas camera={{ position: [120, -160, 120], fov: FOV, near: 0.5, far: 5000 }}>
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
      <FitCamera model={info ? { width, depth } : null} plate={printer ? { width: plateWidth, depth: plateDepth } : null} />
    </Canvas>
  )
}
