import { createActions } from '../../app/actions'
import { createFieldNormalizer } from '../../app/field-normalizer'
import { createEmptyDocument } from '../../document/factory'
import { setFieldInput } from '../../document/formula-ops'
import type { BloKadeDocument, FieldKey, NodeId } from '../../document/types'
import { registry } from '../../plugins/index'
import { createBloKadeStore } from '../../store/store'
import { shapesOf } from '../checks'
import { lessonDesignName } from '../names'
import type { Tutorial } from '../types'
import { isStepDone, lessonView } from '../view'

/** A practice design plus the real actions, for walking through a tutorial the way Kade would. */
export function lessonHarness(tutorial: Tutorial) {
  const store = createBloKadeStore({ designId: 'practice', doc: createEmptyDocument(lessonDesignName(tutorial.title)) })
  const actions = createActions(store, registry)
  const normalize = createFieldNormalizer(registry)
  const view = () => lessonView(store.getState())
  const stepById = (id: string) => {
    const found = tutorial.steps.find((s) => s.id === id)
    if (!found) throw new Error(`Tutorial ${tutorial.id} has no step ${id}`)
    return found
  }
  return {
    store,
    actions,
    normalize,
    done: (stepId: string): boolean => isStepDone(stepById(stepId), view()),
    firstShape: (shapeType: string): NodeId => {
      const shape = shapesOf(view(), shapeType)[0]
      if (!shape) throw new Error(`No ${shapeType} yet`)
      return shape.id
    },
    setField: (id: NodeId, key: FieldKey, text: string): void =>
      store.getState().apply((d) => setFieldInput(d, id, key, text, normalize)),
    apply: (fn: (doc: BloKadeDocument) => BloKadeDocument): void => store.getState().apply(fn),
  }
}
