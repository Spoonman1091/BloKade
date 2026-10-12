import { render } from '@testing-library/react'
import { createEmptyDocument, createShapeNode } from '../../document/factory'
import { addModifier } from '../../document/modifiers'
import { addNode } from '../../document/ops'
import type { BloKadeDocument } from '../../document/types'
import type { LessonStore } from '../../learn/lesson-store'
import { StoreProvider } from '../../store/context'
import { createBloKadeStore, type BloKadeStore } from '../../store/store'
import { Workspace } from '../../ui/Workspace'
import type { AppDeps } from '../deps'
import { fakeDeps } from './fakes'

/** The whole main screen. Test files must `vi.mock('../viewport/Viewport', …)` (path relative to them) first. */
export function renderMainScreen(store: BloKadeStore, lessons?: LessonStore, deps: AppDeps = fakeDeps()) {
  return render(<StoreProvider store={store}><Workspace deps={deps} lessons={lessons} /></StoreProvider>)
}

function richDoc(): BloKadeDocument {
  const box = createShapeNode({ id: 'b', shapeType: 'box', name: 'Box', params: { width: 20, depth: 20, height: 20 }, color: '#fff' })
  const cyl = createShapeNode({ id: 'c', shapeType: 'cylinder', name: 'Cylinder', params: { diameter: 20, height: 20 }, color: '#fff' })
  const withParts = addNode(addNode({ ...createEmptyDocument('Sample'), variables: [{ name: 'wall', expr: '3' }] }, box), cyl)
  // Order matters: tutorials point at mod-radius-0 (fillet) and mod-count-1 (linearPattern).
  const types = ['fillet', 'linearPattern', 'chamfer', 'circularPattern', 'mirror'] as const
  return types.reduce((d, type) => addModifier(d, 'b', type).doc, withParts)
}

/** Stores that between them show every control on the main screen. */
export function sampleStores(): BloKadeStore[] {
  const one = createBloKadeStore({ designId: 'one', doc: richDoc() })
  one.getState().select(['b'])
  one.getState().setWorkplane({ origin: [0, 0, 20], rotation: [0, 0, 0] })
  one.getState().notify('A message')
  const cylinder = createBloKadeStore({ designId: 'cyl', doc: richDoc() })
  cylinder.getState().select(['c'])
  const two = createBloKadeStore({ designId: 'two', doc: richDoc() })
  two.getState().select(['b', 'c'])
  const empty = createBloKadeStore({ designId: 'empty', doc: createEmptyDocument() })
  return [one, cylinder, two, empty]
}
