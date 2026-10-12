import { describe, expect, it } from 'vitest'
import { createEmptyDocument } from '../document/factory'
import { visibleOverlapOf } from './overlap'
import { createBloKadeStore } from './store'

describe('visibleOverlapOf (Review Focus 5)', () => {
  it('shows the result only while the design and selection are the ones that were checked', () => {
    const store = createBloKadeStore({ designId: 'd', doc: createEmptyDocument() })
    const s = store.getState()
    s.setOverlap({ doc: s.history.present, selection: s.selection, result: { status: 'none' } })
    expect(visibleOverlapOf(store.getState())).toEqual({ status: 'none' })
    store.getState().select([])
    expect(visibleOverlapOf(store.getState())).toBeNull()
    const again = store.getState()
    again.setOverlap({ doc: again.history.present, selection: again.selection, result: { status: 'none' } })
    store.getState().apply((d) => ({ ...d, name: 'Changed' }))
    expect(visibleOverlapOf(store.getState())).toBeNull()
  })

  it('forgets the result when another design opens', () => {
    const store = createBloKadeStore({ designId: 'd', doc: createEmptyDocument() })
    const s = store.getState()
    s.setOverlap({ doc: s.history.present, selection: s.selection, result: { status: 'none' } })
    store.getState().openDesign('e', createEmptyDocument())
    expect(store.getState().overlap).toBeNull()
  })
})
