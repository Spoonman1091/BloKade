import { TransformControls } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState, type ComponentRef } from 'react'
import { MathUtils, Vector3, type Object3D } from 'three'
import { translateBox } from '../document/box'
import { updateNode } from '../document/ops'
import { transformFromParts } from '../document/transform-math'
import type { SceneNode, Transform, Vec3 } from '../document/types'
import type { PluginRegistry } from '../plugins/registry'
import { useBloKade, useBloKadeStore } from '../store/context'
import type { ToolMode } from '../store/store'
import { meshBox, topLevelBoxes } from './bounds'
import { formatMeasurement, measure } from './measure'
import { axesOf, snapToObjects } from './object-snap'
import { paramsFromScale } from './sizing'
import { useShiftHeld } from './useShiftHeld'

const ROTATION_SNAP = MathUtils.degToRad(15)
const CONTROL_MODES = { move: 'translate', rotate: 'rotate', size: 'scale' } as const

const sameTransform = (a: Transform, b: Transform): boolean =>
  a.position.every((v, i) => v === b.position[i]) && a.rotation.every((v, i) => v === b.rotation[i])

function edited(node: SceneNode, tool: ToolMode, transform: Transform, scale: Vec3, registry: PluginRegistry): SceneNode {
  if (node.kind !== 'shape' || tool !== 'size') return { ...node, transform }
  const plugin = registry.get(node.shapeType)
  return plugin ? { ...node, transform, params: paramsFromScale(plugin, node.params, scale) } : { ...node, transform }
}

// `axis` is public at runtime on TransformControls but declared private in three-stdlib's types.
const draggedAxis = (c: unknown): string | null => {
  const a = (c as { axis?: unknown } | null)?.axis
  return typeof a === 'string' ? a : null
}

interface TransformHandlesProps {
  registry: PluginRegistry
  /** Live size/distance text while dragging; null when the drag ends. */
  onMeasure(text: string | null): void
}

export function TransformHandles({ registry, onMeasure }: TransformHandlesProps) {
  const store = useBloKadeStore()
  const doc = useBloKade((s) => s.history.present)
  const selection = useBloKade((s) => s.selection)
  const tool = useBloKade((s) => s.tool)
  const meshes = useBloKade((s) => s.meshes)
  const scene = useThree((s) => s.scene)
  const shiftHeld = useShiftHeld()
  const [target, setTarget] = useState<Object3D | null>(null)
  const controls = useRef<ComponentRef<typeof TransformControls>>(null)

  const selectedId = selection.length === 1 ? selection[0] : undefined
  const id = selectedId && doc.root.includes(selectedId) ? selectedId : null
  const node = id && Object.hasOwn(doc.nodes, id) ? doc.nodes[id] : undefined
  const others = useMemo(() => topLevelBoxes(doc, meshes).filter((b) => b.id !== id), [doc, meshes, id])

  useEffect(() => {
    setTarget(id ? scene.getObjectByName(id) ?? null : null)
  }, [id, scene, meshes])

  if (!node || !target || (tool === 'size' && node.kind !== 'shape')) return null

  const displayed = Object.hasOwn(meshes, node.id) ? meshes[node.id] : undefined

  const onObjectChange = (): void => {
    target.updateMatrixWorld()
    const box = displayed ? meshBox(displayed.mesh.positions, target.matrixWorld) : null
    if (!box) return
    // Shift means "free": no grid snap and no object snap.
    const snap = tool === 'move' && !shiftHeld ? snapToObjects(box, others, axesOf(draggedAxis(controls.current))) : null
    if (snap && snap.offset.some((v) => v !== 0)) target.position.add(new Vector3(...snap.offset))
    const text = formatMeasurement(measure(snap ? translateBox(box, snap.offset) : box, others))
    onMeasure(snap?.snappedTo ? `${text} · lined up with ${snap.snappedTo}` : text)
  }

  const commit = (): void => {
    onMeasure(null)
    const transform = transformFromParts(
      [target.position.x, target.position.y, target.position.z],
      [target.rotation.x, target.rotation.y, target.rotation.z],
    )
    const scale: Vec3 = [target.scale.x, target.scale.y, target.scale.z]
    // TransformControls scales the three.js object directly; BloKade stores size in parameters instead.
    target.scale.set(1, 1, 1)
    if (scale.every((s) => s === 1) && sameTransform(transform, node.transform)) return
    store.getState().apply((d) => updateNode(d, node.id, (n) => edited(n, tool, transform, scale, registry)))
  }

  const gridSnap = doc.settings.gridSnap
  return (
    <TransformControls
      ref={controls}
      object={target}
      mode={CONTROL_MODES[tool]}
      translationSnap={gridSnap > 0 && !shiftHeld ? gridSnap : null}
      rotationSnap={shiftHeld ? null : ROTATION_SNAP}
      onObjectChange={onObjectChange}
      onMouseUp={commit}
    />
  )
}
