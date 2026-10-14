// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { Group, PerspectiveCamera, Vector3 } from 'three'
import { describe, expect, it, vi } from 'vitest'
import type { Box } from '../document/box'
import { createEmptyDocument, createShapeNode } from '../document/factory'
import { addNode } from '../document/ops'
import type { ShapeNode } from '../document/types'
import type { DisplayedMesh } from '../store/merge-build'
import { registry } from '../plugins/index'
import { StoreProvider } from '../store/context'
import { createBloKadeStore } from '../store/store'
import { handlesFor, type SizeHandle } from './face-handles'
import type { PointerSpot } from './handle-drag'
import { useSizeDrag } from './useSizeDrag'

const RECT = { left: 0, top: 0, width: 800, height: 600 }
const camera = new PerspectiveCamera(45, RECT.width / RECT.height, 0.5, 5000)
camera.up.set(0, 0, 1)
camera.position.set(0, -150, 60)
camera.lookAt(0, 0, 10)
camera.updateMatrixWorld()
camera.updateProjectionMatrix()
const controls = { enabled: true }
const gl = { domElement: { getBoundingClientRect: () => RECT } }

vi.mock('@react-three/fiber', () => ({
  useThree: (pick: (s: unknown) => unknown) => pick({ gl, camera, controls }),
}))

const BOX: Box = { min: [-10, -10, 0], max: [10, 10, 20] }
const mesh = (): DisplayedMesh => ({
  mesh: { positions: new Float32Array(), normals: new Float32Array(), indices: new Uint32Array(), edges: new Float32Array() },
  stale: false,
})

/** Where a point in the part's frame shows on screen. */
function spotOf(x: number, y: number, z: number): PointerSpot {
  const p = new Vector3(x, y, z).project(camera)
  return { clientX: ((p.x + 1) / 2) * RECT.width, clientY: ((1 - p.y) / 2) * RECT.height, shiftKey: false, altKey: false }
}

function setup() {
  const plugin = registry.get('box')
  if (!plugin) throw new Error('box')
  const node: ShapeNode = createShapeNode({ id: 'b', shapeType: 'box', name: 'Box', params: { width: 20, depth: 20, height: 20 }, color: '#f00' })
  const store = createBloKadeStore({ designId: 'd', doc: addNode(createEmptyDocument(), node) })
  const target = new Group()
  const handle = handlesFor(plugin, BOX).find((h) => h.id === 'x+') as SizeHandle
  const wrapper = ({ children }: { children: ReactNode }) => <StoreProvider store={store}>{children}</StoreProvider>
  const hook = renderHook(({ built }: { built: DisplayedMesh }) => useSizeDrag(node, plugin, BOX, target, built, () => undefined),
    { wrapper, initialProps: { built: mesh() } })
  const drag = (to: number): void => {
    act(() => hook.result.current.begin(handle, spotOf(10, 0, 10)))
    act(() => { window.dispatchEvent(new MouseEvent('pointermove', spotOf(to, 0, 10))) })
  }
  const dragCorner = (): void => {
    const corner = handlesFor(plugin, BOX).find((h) => h.id === 'corner-x+y+') as SizeHandle
    act(() => hook.result.current.begin(corner, spotOf(10, 10, 0)))
    act(() => { window.dispatchEvent(new MouseEvent('pointermove', spotOf(20, 10, 0))) })
  }
  const release = (): void => act(() => { window.dispatchEvent(new MouseEvent('pointerup')) })
  return { store, target, hook, drag, dragCorner, release }
}

describe('useSizeDrag', () => {
  it('keeps the stretched preview after letting go until the rebuilt part arrives', () => {
    const { store, target, hook, drag, release } = setup()
    drag(30)
    const stretched = target.scale.x
    expect(stretched).toBeGreaterThan(1.5)
    release()
    expect(store.getState().history.present.nodes['b']).toMatchObject({ params: { width: 40 } })
    expect(target.scale.x).toBe(stretched)
    expect(hook.result.current.frame).not.toBeNull()
    hook.rerender({ built: mesh() })
    expect(target.scale.x).toBe(1)
    expect(hook.result.current.frame).toBeNull()
  })

  it('ignores a new press while waiting for the rebuilt part', () => {
    const { hook, drag, release } = setup()
    drag(30)
    release()
    drag(40)
    expect(hook.result.current.activeHandle).toBeNull()
  })

  it('puts the preview back at once when Esc cancels', () => {
    const { target, drag } = setup()
    drag(30)
    act(() => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })) })
    expect(target.scale.x).toBe(1)
  })

  it('puts the preview back when the handles go away before the rebuilt part arrives', () => {
    const { target, hook, drag, release } = setup()
    drag(30)
    release()
    hook.unmount()
    expect(target.scale.x).toBe(1)
  })
})

describe('Shift and Alt during a drag', () => {
  const key = (type: 'keydown' | 'keyup', name: 'Shift' | 'Alt', held: boolean): void =>
    act(() => { window.dispatchEvent(new KeyboardEvent(type, { key: name, shiftKey: name === 'Shift' && held, altKey: name === 'Alt' && held })) })

  it('turns snapping off and on again straight away, without moving the mouse', () => {
    const { target, drag } = setup()
    drag(30.4)
    expect(target.scale.x).toBe(2)
    key('keydown', 'Shift', true)
    expect(target.scale.x).toBeCloseTo(40.4 / 20, 2)
    key('keyup', 'Shift', false)
    expect(target.scale.x).toBe(2)
  })

  it('keeps proportions as soon as Alt goes down on a corner', () => {
    const { target, dragCorner } = setup()
    dragCorner()
    expect(target.scale.z).toBe(1)
    key('keydown', 'Alt', true)
    expect(target.scale.z).toBeCloseTo(1.5, 2)
  })
})
