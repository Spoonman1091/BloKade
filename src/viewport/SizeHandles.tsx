import { Html } from '@react-three/drei'
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { MathUtils, Matrix4, PerspectiveCamera, Vector3, type Group, type Object3D } from 'three'
import type { Box } from '../document/box'
import type { ShapeNode, Vec3 } from '../document/types'
import type { ShapePlugin } from '../plugins/types'
import type { DisplayedMesh } from '../store/merge-build'
import { TOOLTIP_DELAY_MS } from '../ui/HelpTooltips'
import { meshBox } from './bounds'
import { handlesFor, handleTip, type SizeHandle } from './face-handles'
import { screenScale, type PointerSpot } from './handle-drag'
import { useSizeDrag } from './useSizeDrag'

const HANDLE_PX = 10
const BORDER_COLOR = '#1d2433'
const HANDLE_COLOR = '#ffffff'
const HOT_COLOR = '#4f9dff'
const FACE_SIZE = 0.72
const FALLBACK_FOV = 45
const ON_TOP = 1000
const IDENTITY = new Matrix4()
const NO_SCALE: Vec3 = [1, 1, 1]

const scaled = (p: Vec3, s: Vec3): Vec3 => [p[0] * s[0], p[1] * s[1], p[2] * s[2]]
const radians = (r: Vec3): Vec3 => [MathUtils.degToRad(r[0]), MathUtils.degToRad(r[1]), MathUtils.degToRad(r[2])]

interface HandleCubeProps {
  readonly handle: SizeHandle
  readonly at: Vec3
  readonly hot: boolean
  onOver(handle: SizeHandle): void
  onOut(handle: SizeHandle): void
  onDown(handle: SizeHandle, spot: PointerSpot): void
}

/** One handle: a white square with a dark border, the same size on screen at any zoom, drawn on top of the part. */
function HandleCube({ handle, at, hot, onOver, onOut, onDown }: HandleCubeProps) {
  const ref = useRef<Group>(null)
  const camera = useThree((s) => s.camera)
  const height = useThree((s) => s.size.height)
  useFrame(() => {
    const group = ref.current
    if (!group) return
    const fov = camera instanceof PerspectiveCamera ? camera.fov : FALLBACK_FOV
    const distance = group.getWorldPosition(new Vector3()).distanceTo(camera.position)
    group.scale.setScalar(screenScale(distance, fov, height, HANDLE_PX))
  })
  const down = (event: ThreeEvent<PointerEvent>): void => {
    if (event.button !== 0) return
    event.stopPropagation()
    onDown(handle, event.nativeEvent)
  }
  return (
    <group ref={ref} position={at} userData={{ sizeHandle: handle.id }}
      onPointerOver={(e) => { e.stopPropagation(); onOver(handle) }} onPointerOut={() => onOut(handle)}
      onPointerDown={down} onClick={(e) => e.stopPropagation()}>
      <mesh renderOrder={ON_TOP}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial color={BORDER_COLOR} depthTest={false} transparent />
      </mesh>
      <mesh renderOrder={ON_TOP + 1} scale={FACE_SIZE}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial color={hot ? HOT_COLOR : HANDLE_COLOR} depthTest={false} transparent />
      </mesh>
    </group>
  )
}

/** Hover state, the delayed tip, and the canvas's data-help so ❓ help mode can explain the handle. */
function useHover(dragging: boolean) {
  const gl = useThree((s) => s.gl)
  const [hovered, setHovered] = useState<SizeHandle | null>(null)
  const [tip, setTip] = useState<string | null>(null)
  useEffect(() => {
    setTip(null)
    const el = gl.domElement
    if (!hovered) {
      delete el.dataset.help
      el.style.cursor = ''
      return undefined
    }
    el.dataset.help = hovered.kind === 'corner' ? 'size-corner' : 'size-handle'
    el.style.cursor = 'grab'
    if (dragging) return undefined
    const timer = setTimeout(() => setTip(hovered.id), TOOLTIP_DELAY_MS)
    return () => clearTimeout(timer)
  }, [hovered, dragging, gl])
  useEffect(() => () => {
    delete gl.domElement.dataset.help
    gl.domElement.style.cursor = ''
  }, [gl])
  const out = (handle: SizeHandle): void => setHovered((current) => (current?.id === handle.id ? null : current))
  return { hovered: hovered?.id ?? null, tip, over: setHovered, out }
}

/** Writes each handle's spot on the canvas as data-size-handles, so end-to-end tests can find them. */
function useHandleSpots(group: RefObject<Group | null>): void {
  const gl = useThree((s) => s.gl)
  const camera = useThree((s) => s.camera)
  const size = useThree((s) => s.size)
  const last = useRef('')
  useFrame(() => {
    const children: readonly Object3D[] = group.current?.children ?? []
    const spots = Object.fromEntries(children.flatMap((child) => {
      const id: unknown = child.userData.sizeHandle
      if (typeof id !== 'string') return []
      const ndc = child.getWorldPosition(new Vector3()).project(camera)
      return [[id, [Math.round(((ndc.x + 1) / 2) * size.width), Math.round(((1 - ndc.y) / 2) * size.height)]]]
    }))
    const text = JSON.stringify(spots)
    if (text === last.current) return
    last.current = text
    gl.domElement.dataset.sizeHandles = text
  })
  useEffect(() => () => {
    delete gl.domElement.dataset.sizeHandles
  }, [gl])
}

interface HandlesProps {
  readonly node: ShapeNode
  readonly plugin: ShapePlugin
  readonly box: Box
  readonly target: Object3D
  readonly built: DisplayedMesh
  onMeasure(text: string | null): void
}

function Handles({ node, plugin, box, target, built, onMeasure }: HandlesProps) {
  const group = useRef<Group>(null)
  const handles = useMemo(() => handlesFor(plugin, box), [plugin, box])
  const drag = useSizeDrag(node, plugin, box, target, built, onMeasure)
  const hover = useHover(drag.activeHandle !== null)
  useHandleSpots(group)
  const scale = drag.frame?.scale ?? NO_SCALE
  const tipHandle = hover.tip ? handles.find((h) => h.id === hover.tip) : undefined
  return (
    <group ref={group} position={drag.frame?.position ?? node.transform.position} rotation={radians(node.transform.rotation)}>
      {handles.map((h) => (
        <HandleCube key={h.id} handle={h} at={scaled(h.position, scale)} hot={h.id === hover.hovered || h.id === drag.activeHandle}
          onOver={hover.over} onOut={hover.out} onDown={drag.begin} />
      ))}
      {tipHandle && (
        <Html position={scaled(tipHandle.position, scale)} style={{ pointerEvents: 'none' }}>
          <div className="help-tooltip size-handle-tip" role="tooltip" data-testid="size-handle-tip">{handleTip(plugin, tipHandle)}</div>
        </Html>
      )}
    </group>
  )
}

interface SizeHandlesProps {
  readonly node: ShapeNode
  readonly plugin: ShapePlugin
  readonly displayed: DisplayedMesh
  /** The three.js object drawn for the part; it is stretched live while dragging. */
  readonly target: Object3D
  onMeasure(text: string | null): void
}

/** TinkerCAD-style size handles: drag a side, the top or a bottom corner, and the far side stays put. */
export function SizeHandles({ node, plugin, displayed, target, onMeasure }: SizeHandlesProps) {
  const box = useMemo(() => meshBox(displayed.mesh.positions, IDENTITY), [displayed.mesh])
  return box ? <Handles node={node} plugin={plugin} box={box} target={target} built={displayed} onMeasure={onMeasure} /> : null
}
