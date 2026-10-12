import { strFromU8, unzipSync } from 'fflate'
import { describe, expect, it } from 'vitest'
import { write3mf } from './export-3mf'

describe('write3mf', () => {
  it('writes a 3MF package with the mesh in millimeters', () => {
    const bytes = write3mf({ vertices: [0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1], triangles: [0, 1, 2, 0, 3, 1, 1, 3, 2, 2, 3, 0] }, 'Kade & "Dad"')
    const files = unzipSync(bytes)
    expect(Object.keys(files).sort()).toEqual(['3D/3dmodel.model', '[Content_Types].xml', '_rels/.rels'])
    const model = strFromU8(files['3D/3dmodel.model'] as Uint8Array)
    expect(model).toContain('unit="millimeter"')
    expect(model.match(/<vertex /g)).toHaveLength(4)
    expect(model.match(/<triangle /g)).toHaveLength(4)
    expect(model).toContain('Kade &amp; &quot;Dad&quot;')
  })
})
