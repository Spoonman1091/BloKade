import { beforeAll, describe, expect, it } from 'vitest'
import { strFromU8, unzipSync } from 'fflate'
import { createEmptyDocument, createShapeNode } from '../document/factory'
import { addNode, groupNodes, setHidden, setMode } from '../document/ops'
import type { BloKadeDocument } from '../document/types'
import { createCadToolkit } from '../plugins/cad'
import { registry } from '../plugins/index'
import { createGeometryApi, exportTargets } from './api'
import { Evaluator } from './evaluate'
import { initTestOC } from './testing/oc-node'
import { meshVolume, parseBinaryStl } from './testing/stl'
import { countOpenEdges, weldMesh } from './weld'

beforeAll(initTestOC)

const shape = (id: string, shapeType: string, params: Record<string, number>, position: [number, number, number] = [0, 0, 0]) =>
  createShapeNode({ id, shapeType, name: id, params, color: '#fff', position })

function design(): BloKadeDocument {
  const doc = [
    shape('box', 'box', { width: 20, depth: 20, height: 20 }),
    shape('hole', 'cylinder', { diameter: 10, height: 40 }, [0, 0, -10]),
    shape('ball', 'sphere', { diameter: 10 }, [50, 0, 0]),
  ].reduce((d, n) => addNode(d, n), createEmptyDocument('Test part'))
  return groupNodes(setMode(doc, ['hole'], 'hole'), ['box', 'hole'], 'g').doc
}

const newApi = () => createGeometryApi(new Evaluator(registry, createCadToolkit()))

describe('geometry api', () => {
  it('rebuilds every top-level part into a mesh', async () => {
    const result = await newApi().rebuild(design())
    expect(Object.keys(result.nodes).sort()).toEqual(['ball', 'g'])
    const g = result.nodes.g
    expect(g?.status).toBe('ok')
    if (g?.status === 'ok') {
      expect(g.mesh.positions.length).toBeGreaterThan(0)
      expect(g.mesh.indices.length % 3).toBe(0)
      expect(g.mesh.edges.length).toBeGreaterThan(0)
    }
  })

  it('reports a broken part without failing the others', async () => {
    const broken = addNode(design(), shape('ring', 'torus', { diameter: 10, thickness: 10 }))
    const result = await newApi().rebuild(broken)
    expect(result.nodes.ring).toEqual({ status: 'error', message: "Ring couldn't be built: Make the ring wider than twice its thickness." })
    expect(result.nodes.g?.status).toBe('ok')
  })

  it('exports a watertight STL with the right volume', async () => {
    const doc = setHidden(design(), ['ball'], true)
    const stl = parseBinaryStl(await newApi().exportStl(doc))
    const welded = weldMesh(stl.vertices, stl.triangles)
    expect(countOpenEdges(welded.triangles)).toBe(0)
    expect(meshVolume(welded.vertices, welded.triangles)).toBeCloseTo(8000 - Math.PI * 25 * 20, -1)
  })

  it('exports a watertight 3MF', async () => {
    const files = unzipSync(new Uint8Array(await newApi().export3mf(design(), ['ball'])))
    const model = strFromU8(files['3D/3dmodel.model'] as Uint8Array)
    expect(model).toContain('<metadata name="Title">Test part</metadata>')
    expect(model.match(/<triangle /g)?.length).toBeGreaterThan(100)
  })

  it('exports only visible solid top-level parts, mapping children to their group', () => {
    const doc = addNode(setMode(design(), ['ball'], 'hole'), shape('hidden', 'box', {}))
    const hidden = setHidden(doc, ['hidden'], true)
    expect(exportTargets(hidden)).toEqual(['g'])
    expect(exportTargets(hidden, ['box', 'hole'])).toEqual(['g'])
  })

  it('refuses to export nothing', async () => {
    const doc = setHidden(design(), ['g', 'ball'], true)
    await expect(newApi().exportStl(doc)).rejects.toThrow("There's nothing to export")
  })

  it('refuses to export a part with a problem', async () => {
    const doc = addNode(createEmptyDocument(), shape('ring', 'torus', { diameter: 10, thickness: 10 }))
    await expect(newApi().exportStl(doc)).rejects.toThrow('"ring" has a problem')
  })
})
