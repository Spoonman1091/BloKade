import { describe, expect, it, vi } from 'vitest'
import { createEmptyDocument } from '../document/factory'
import { createBloKadeStore } from '../store/store'
import { exportDesign } from './export'

const store = () => createBloKadeStore({ designId: 'd', doc: createEmptyDocument('Phone Stand') })

describe('exportDesign', () => {
  it('downloads the export with a friendly file name', async () => {
    const download = vi.fn()
    const data = new ArrayBuffer(84)
    const client = { exportStl: vi.fn().mockResolvedValue(data), export3mf: vi.fn() }
    await exportDesign({ client, store: store(), format: 'stl', download })
    expect(client.exportStl).toHaveBeenCalledWith(expect.objectContaining({ name: 'Phone Stand' }), undefined)
    expect(download).toHaveBeenCalledWith(data, 'phone-stand.stl', 'model/stl')
  })

  it('exports only the selection when something is selected', async () => {
    const s = store()
    const client = { exportStl: vi.fn(), export3mf: vi.fn().mockResolvedValue(new ArrayBuffer(1)) }
    s.setState({ selection: ['a'] })
    await exportDesign({ client, store: s, format: '3mf', download: vi.fn() })
    expect(client.export3mf).toHaveBeenCalledWith(expect.anything(), ['a'])
  })

  it('shows export problems as a notice', async () => {
    const s = store()
    const client = { exportStl: vi.fn().mockRejectedValue(new Error("There's nothing to export.")), export3mf: vi.fn() }
    await exportDesign({ client, store: s, format: 'stl', download: vi.fn() })
    expect(s.getState().notice).toBe("There's nothing to export.")
  })
})
