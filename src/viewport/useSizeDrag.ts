import { useThree } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { Object3D } from 'three'
import type { Box } from '../document/box'
import { updateNode } from '../document/ops'
import type { ShapeNode } from '../document/types'
import type { ShapePlugin } from '../plugins/types'
import { useBloKade, useBloKadeStore } from '../store/context'
import type { DisplayedMesh } from '../store/merge-build'
import type { SizeHandle } from './face-handles'
import { pointerRay, toLocalRay, trackPoint, type PointerSpot } from './handle-drag'
import { finishSizeDrag, sizeDragFrame, type SizeDragFrame, type SizeDragStart } from './size-drag'

/** The camera controls (OrbitControls, made default in Viewport). Only `enabled` matters here. */
interface Toggleable {
  enabled: boolean
}

export interface SizeDragControls {
  /** The live preview while dragging, or null. */
  readonly frame: SizeDragFrame | null
  /** The id of the handle being dragged, or null. */
  readonly activeHandle: string | null
  begin(handle: SizeHandle, spot: PointerSpot): void
}

interface DragHandlers {
  move(event: PointerEvent): void
  up(): void
  cancel(): void
  key(event: KeyboardEvent): void
}

function showFrame(target: Object3D, frame: SizeDragFrame): void {
  target.scale.set(...frame.scale)
  target.position.set(...frame.position)
}

function resetTarget(target: Object3D, node: ShapeNode): void {
  target.scale.set(1, 1, 1)
  target.position.set(...node.transform.position)
}

/** Listens on the window while a handle is dragged, so letting go anywhere ends the drag. */
function listen(handlers: DragHandlers): () => void {
  const pairs: [keyof WindowEventMap, EventListener, boolean][] = [
    ['pointermove', handlers.move as EventListener, false],
    ['pointerup', handlers.up, false],
    ['pointercancel', handlers.cancel, false],
    ['blur', handlers.cancel, false],
    ['keydown', handlers.key as EventListener, true],
    ['keyup', handlers.key as EventListener, true],
  ]
  for (const [type, fn, capture] of pairs) window.addEventListener(type, fn, capture)
  return () => {
    for (const [type, fn, capture] of pairs) window.removeEventListener(type, fn, capture)
  }
}

/**
 * The browser follows a pointer release with a click, and R3F hands it to the part under the pointer, so letting go
 * over the part with Shift held would toggle it out of the selection. A drag is never a click: swallow that one.
 */
function swallowNextClick(): void {
  const swallow = (event: MouseEvent): void => {
    event.stopPropagation()
    stop()
  }
  const stop = (): void => {
    window.removeEventListener('click', swallow, true)
    window.clearTimeout(timer)
  }
  window.addEventListener('click', swallow, true)
  // The click comes straight after the release, before any timer, so this only drops a listener nothing used.
  const timer = window.setTimeout(stop, 0)
}

/** Shift (snapping off) and Alt (keep proportions) change the preview the moment they go down or up. */
const MODIFIER_KEYS: ReadonlySet<string> = new Set(['Shift', 'Alt'])

/**
 * Every key is swallowed while dragging, so design shortcuts can't change the part under the pointer. Esc cancels;
 * Shift and Alt redraw the preview at once, without waiting for the mouse to move.
 */
const keyHandler = (cancel: () => void, modifiers: (event: KeyboardEvent) => void) => (event: KeyboardEvent): void => {
  event.preventDefault()
  event.stopPropagation()
  if (event.type === 'keydown' && event.key === 'Escape') cancel()
  else if (MODIFIER_KEYS.has(event.key)) modifiers(event)
}

/**
 * Runs one handle drag: live preview, one undo step on release, nothing written on Esc. The window listeners
 * go on at the press itself, not in an effect, so a quick press-drag-release can't finish before they exist.
 *
 * `built` is the part's mesh as last built. After a release that changed the part, the stretched preview stays
 * until the next build arrives: dropping it at once would show the old, smaller mesh at the new spot for a moment.
 */
export function useSizeDrag(
  node: ShapeNode, plugin: ShapePlugin, box: Box, target: Object3D, built: DisplayedMesh, onMeasure: (text: string | null) => void,
): SizeDragControls {
  const gl = useThree((s) => s.gl)
  const camera = useThree((s) => s.camera)
  const controls = useThree((s) => s.controls) as unknown as Toggleable | null
  const store = useBloKadeStore()
  const gridSnap = useBloKade((s) => s.history.present.settings.gridSnap)
  const [frame, setFrame] = useState<SizeDragFrame | null>(null)
  const [activeHandle, setActiveHandle] = useState<string | null>(null)
  const last = useRef<SizeDragFrame | null>(null)
  const cancelDrag = useRef<(() => void) | null>(null)
  /** The build that was showing when a changed part was let go of, while its rebuild is on the way. */
  const waitingOn = useRef<DisplayedMesh | null>(null)
  // Unmounting mid-drag (selection or tool changed) ends the drag without writing anything.
  useEffect(() => () => {
    cancelDrag.current?.()
    if (waitingOn.current) target.scale.set(1, 1, 1)
  }, [target])
  // A layout effect, so the new mesh never draws with the old preview stretch on top of it.
  useLayoutEffect(() => {
    if (!waitingOn.current || waitingOn.current === built) return
    waitingOn.current = null
    resetTarget(target, node)
    setFrame(null)
  }, [built, target, node])

  const pointOn = (handle: SizeHandle, spot: PointerSpot) =>
    trackPoint(handle, toLocalRay(pointerRay(spot, gl.domElement, camera), node.transform))

  const show = (start: SizeDragStart, event: PointerSpot): void => {
    const to = pointOn(start.handle, event)
    if (!to) return
    const next = sizeDragFrame(start, to, { snap: event.shiftKey ? 0 : gridSnap, keepProportions: event.altKey })
    last.current = next
    showFrame(target, next)
    setFrame(next)
    onMeasure(next.text)
  }

  const begin = (handle: SizeHandle, spot: PointerSpot): void => {
    const from = pointOn(handle, spot)
    if (!from || cancelDrag.current || waitingOn.current) return
    const start: SizeDragStart = { node, plugin, box, handle, from }
    // Where the pointer last was, so Shift or Alt can redraw the preview there.
    let pointer: PointerSpot = spot
    const move = (event: PointerEvent): void => {
      pointer = event
      show(start, event)
    }
    const modifiers = (event: KeyboardEvent): void =>
      show(start, { clientX: pointer.clientX, clientY: pointer.clientY, shiftKey: event.shiftKey, altKey: event.altKey })
    const end = (commit: boolean): void => {
      stop()
      cancelDrag.current = null
      if (controls) controls.enabled = true
      const edited = commit && last.current ? finishSizeDrag(start, last.current) : null
      last.current = null
      if (edited) {
        waitingOn.current = built
      } else {
        resetTarget(target, node)
        setFrame(null)
      }
      setActiveHandle(null)
      onMeasure(null)
      if (edited) store.getState().apply((d) => updateNode(d, node.id, () => edited))
    }
    const stop = listen({ move, up: () => { end(true); swallowNextClick() }, cancel: () => end(false), key: keyHandler(() => end(false), modifiers) })
    cancelDrag.current = () => end(false)
    // OrbitControls saw this press first; turning it off now stops it from spinning the camera as the mouse moves.
    if (controls) controls.enabled = false
    setActiveHandle(handle.id)
  }
  return { frame, activeHandle, begin }
}
