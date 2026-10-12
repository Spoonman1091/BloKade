import { TransformControls } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState, type ComponentRef } from 'react'
import { MathUtils, Vector3, type Object3D } from 'three'
import { updateNode } from '../document/ops'
import { keepUnchanged, transformFromParts } from '../document/transform-math'
import type { SceneNode, Transform } from '../document/types'
import type { PluginRegistry } from '../plugins/registry'
import { useBloKade, useBloKadeStore } from '../store/context'
import { meshBox, topLevelBoxes } from './bounds'
import { dragFeedback } from './drag-feedback'
import { axesOf } from './object-snap'
import { resizesByHandle } from './size-drag'
import { SizeHandles } from './SizeHandles'
import { useShiftHeld } from './useShiftHeld'

const ROTATION_SNAP = MathUtils.degToRad(15)
const CONTROL_MODES = { move: 'translate', rotate: 'rotate' } as const

const sameTransform = (a: Transform, b: Transform): boolean =>
  a.position.every((v, i) => v === b.position[i]) && a.rotation.every((v, i) => v === b.rotation[i])

// `axis` is public at runtime on TransformControls but declared private in three-stdlib's types.
const draggedAxis = (c: unknown): string | null => {
  const a = (c as { axis?: unknown } | null)?.axis
  return typeof a === 'string' ? a : null
}

/** The finished move or turn as a transform, or null when nothing moved. */
function readDrag(target: Object3D, old: Transform): Transform | null {
  const dragged = transformFromParts(
    [target.position.x, target.position.y, target.position.z],
    [target.rotation.x, target.rotation.y, target.rotation.z],
  )
  // Rounding must not count as a change, or untouched fields would lose their formulas.
  const transform: Transform = {
    position: keepUnchanged(old.position, dragged.position),
    rotation: keepUnchanged(old.rotation, dragged.rotation),
  }
  return sameTransform(transform, old) ? null : transform
}

/** The three.js object drawn for a part, found by name once its mesh is in the scene. */
function useSceneObject(id: string | null, meshes: unknown): Object3D | null {
  const scene = useThree((s) => s.scene)
  const [target, setTarget] = useState<Object3D | null>(null)
  useEffect(() => {
    setTarget(id ? scene.getObjectByName(id) ?? null : null)
  }, [id, scene, meshes])
  return target
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
  const shiftHeld = useShiftHeld()
  const controls = useRef<ComponentRef<typeof TransformControls>>(null)

  const selectedId = selection.length === 1 ? selection[0] : undefined
  const id = selectedId && doc.root.includes(selectedId) ? selectedId : null
  const node = id && Object.hasOwn(doc.nodes, id) ? doc.nodes[id] : undefined
  const others = useMemo(() => topLevelBoxes(doc, meshes).filter((b) => b.id !== id), [doc, meshes, id])
  const target = useSceneObject(id, meshes)

  // A drag cut short by unmounting (selection or tool change) must not leave the measurement stuck on screen.
  useEffect(() => () => onMeasure(null), [onMeasure])

  if (!node || !target) return null
  const displayed = Object.hasOwn(meshes, node.id) ? meshes[node.id] : undefined

  if (tool === 'size') {
    const plugin = node.kind === 'shape' ? registry.get(node.shapeType) : undefined
    return node.kind === 'shape' && plugin && displayed && resizesByHandle(node)
      ? <SizeHandles node={node} plugin={plugin} displayed={displayed} target={target} onMeasure={onMeasure} />
      : null
  }

  const onObjectChange = (): void => {
    target.updateMatrixWorld()
    const box = displayed ? meshBox(displayed.mesh.positions, target.matrixWorld) : null
    if (!box) return
    // Shift means "free": no grid snap and no object snap.
    const feedback = dragFeedback(box, others, tool === 'move' && !shiftHeld ? axesOf(draggedAxis(controls.current)) : null)
    if (feedback.offset.some((v) => v !== 0)) target.position.add(new Vector3(...feedback.offset))
    onMeasure(feedback.text)
  }
  const commit = (): void => {
    onMeasure(null)
    const transform = readDrag(target, node.transform)
    if (transform) store.getState().apply((d) => updateNode(d, node.id, (n): SceneNode => ({ ...n, transform })))
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
