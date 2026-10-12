import { describe, expect, it, vi } from 'vitest'
import { createEmptyDocument, createShapeNode } from '../document/factory'
import { addNode, groupNodes, setHidden, setMode } from '../document/ops'
import type { BloKadeDocument } from '../document/types'
import { createBloKadeStore } from '../store/store'
import { exportDesign, LOOSE_HOLES, SELECTION_ONLY } from './export'

const store = () => createBloKadeStore({ designId: 'd', doc: createEmptyDocument('Phone Stand') })

describe('exportDesign', () => {
  it('downloads the export with a friendly file name', async () => {
    const download = vi.fn()
    const data = new ArrayBuffer(84)
    const client = { exportStl: vi.fn().mockResolvedValue(data), export3mf: vi.fn(), exportStep: vi.fn() }
    await exportDesign({ client, store: store(), format: 'stl', download })
    expect(client.exportStl).toHaveBeenCalledWith(expect.objectContaining({ name: 'Phone Stand' }), undefined)
    expect(download).toHaveBeenCalledWith(data, 'phone-stand.stl', 'model/stl')
  })

  it('exports only the selection when something is selected', async () => {
    const s = store()
    const client = { exportStl: vi.fn(), export3mf: vi.fn().mockResolvedValue(new ArrayBuffer(1)), exportStep: vi.fn() }
    s.setState({ selection: ['a'] })
    await exportDesign({ client, store: s, format: '3mf', download: vi.fn() })
    expect(client.export3mf).toHaveBeenCalledWith(expect.anything(), ['a'])
  })

  it('exports STEP with the design name', async () => {
    const download = vi.fn()
    const exportStep = vi.fn(async () => new ArrayBuffer(4))
    await exportDesign({ client: { exportStl: vi.fn(), export3mf: vi.fn(), exportStep }, store: store(), format: 'step', download })
    expect(exportStep).toHaveBeenCalled()
    expect(download).toHaveBeenCalledWith(expect.any(ArrayBuffer), 'phone-stand.step', 'model/step')
  })

  it('shows export problems as a notice', async () => {
    const s = store()
    const client = { exportStl: vi.fn().mockRejectedValue(new Error("There's nothing to export.")), export3mf: vi.fn(), exportStep: vi.fn() }
    await exportDesign({ client, store: s, format: 'stl', download: vi.fn() })
    expect(s.getState().notice).toBe("There's nothing to export.")
  })
})

const part = (id: string) => createShapeNode({ id, shapeType: 'box', name: id, params: {}, color: '#fff' })
const withParts = (...ids: string[]): BloKadeDocument =>
  ids.reduce((d, id) => addNode(d, part(id)), createEmptyDocument('Parts'))
const storeWith = (doc: BloKadeDocument, selection: string[] = []) => {
  const s = createBloKadeStore({ designId: 'd', doc })
  s.setState({ selection })
  return s
}
const okClient = () => ({ exportStl: vi.fn().mockResolvedValue(new ArrayBuffer(84)), export3mf: vi.fn(), exportStep: vi.fn() })

describe('export notices', () => {
  it('says only the selection was exported when other parts are visible', async () => {
    const s = storeWith(withParts('a', 'b'), ['a'])
    await exportDesign({ client: okClient(), store: s, format: 'stl', download: vi.fn() })
    expect(s.getState().notice).toBe(SELECTION_ONLY)
    expect(SELECTION_ONLY).toBe('Exported the selected part(s) only. Click empty space first to export everything.')
  })

  it('stays quiet when the selection is everything visible', async () => {
    const s = storeWith(setHidden(withParts('a', 'b'), ['b'], true), ['a'])
    await exportDesign({ client: okClient(), store: s, format: 'stl', download: vi.fn() })
    expect(s.getState().notice).toBeNull()
  })

  it('stays quiet when exporting everything with no loose holes', async () => {
    const doc = groupNodes(setMode(withParts('a', 'h'), ['h'], 'hole'), ['a', 'h'], 'g').doc
    const s = storeWith(doc)
    await exportDesign({ client: okClient(), store: s, format: 'stl', download: vi.fn() })
    expect(s.getState().notice).toBeNull()
  })

  it('explains that an ungrouped hole was left out', async () => {
    const s = storeWith(setMode(withParts('a', 'h'), ['h'], 'hole'))
    await exportDesign({ client: okClient(), store: s, format: 'stl', download: vi.fn() })
    expect(s.getState().notice).toBe(LOOSE_HOLES)
    expect(LOOSE_HOLES).toBe('Holes only cut when grouped with a solid — select both and press Group.')
  })

  it('ignores hidden loose holes', async () => {
    const s = storeWith(setHidden(setMode(withParts('a', 'h'), ['h'], 'hole'), ['h'], true))
    await exportDesign({ client: okClient(), store: s, format: 'stl', download: vi.fn() })
    expect(s.getState().notice).toBeNull()
  })

  it('shows both messages together', async () => {
    const s = storeWith(setMode(withParts('a', 'b', 'h'), ['h'], 'hole'), ['a', 'h'])
    await exportDesign({ client: okClient(), store: s, format: 'stl', download: vi.fn() })
    expect(s.getState().notice).toBe(`${SELECTION_ONLY} ${LOOSE_HOLES}`)
  })

  it('keeps the error message when the export fails', async () => {
    const s = storeWith(setMode(withParts('a', 'b', 'h'), ['h'], 'hole'), ['a', 'h'])
    const client = { exportStl: vi.fn().mockRejectedValue(new Error('Broken part.')), export3mf: vi.fn(), exportStep: vi.fn() }
    await exportDesign({ client, store: s, format: 'stl', download: vi.fn() })
    expect(s.getState().notice).toBe('Broken part.')
  })
})
