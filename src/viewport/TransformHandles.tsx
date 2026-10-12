import { TransformControls } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import { useEffect, useState } from 'react'
import { MathUtils, type Object3D } from 'three'
import { updateNode } from '../document/ops'
import { transformFromParts } from '../document/transform-math'
import type { SceneNode, Transform, Vec3 } from '../document/types'
import type { PluginRegistry } from '../plugins/registry'
import { useBloKade, useBloKadeStore } from '../store/context'
import type { ToolMode } from '../store/store'
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

export function TransformHandles({ registry }: { registry: PluginRegistry }) {
  const store = useBloKadeStore()
  const doc = useBloKade((s) => s.history.present)
  const selection = useBloKade((s) => s.selection)
  const tool = useBloKade((s) => s.tool)
  const meshes = useBloKade((s) => s.meshes)
  const scene = useThree((s) => s.scene)
  const shiftHeld = useShiftHeld()
  const [target, setTarget] = useState<Object3D | null>(null)

  const selectedId = selection.length === 1 ? selection[0] : undefined
  const id = selectedId && doc.root.includes(selectedId) ? selectedId : null
  const node = id && Object.hasOwn(doc.nodes, id) ? doc.nodes[id] : undefined

  useEffect(() => {
    setTarget(id ? scene.getObjectByName(id) ?? null : null)
  }, [id, scene, meshes])

  if (!node || !target || (tool === 'size' && node.kind !== 'shape')) return null

  const commit = (): void => {
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
      object={target}
      mode={CONTROL_MODES[tool]}
      translationSnap={gridSnap > 0 && !shiftHeld ? gridSnap : null}
      rotationSnap={shiftHeld ? null : ROTATION_SNAP}
      onMouseUp={commit}
    />
  )
}
