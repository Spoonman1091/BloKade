import { beforeAll, describe, expect, it } from 'vitest'
import { strFromU8, unzipSync } from 'fflate'
import { createEmptyDocument, createShapeNode } from '../document/factory'
import { addNode, groupNodes, setHidden, setMode } from '../document/ops'
import { addModifier } from '../document/modifiers'
import type { BloKadeDocument } from '../document/types'
import { createCadToolkit } from '../plugins/cad'
import { registry } from '../plugins/index'
import { KadeShapes } from '../kade/kade-shapes'
import { fileModuleLoader } from '../kade/testing/file-loader'
import { closedMeshFor3mf, createGeometryApi, ExportError } from './api'
import { Evaluator } from './evaluate'
import { exportTargets, looseHoles } from './export-targets'
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

const newApi = () => createGeometryApi(new Evaluator(registry, createCadToolkit()), new KadeShapes(fileModuleLoader, registry))

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
    expect(looseHoles(hidden)).toEqual(['ball'])
    expect(looseHoles(hidden, ['box'])).toEqual([])
  })

  it('refuses a 3MF mesh with gaps in it', () => {
    const tetra = [0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1]
    expect(closedMeshFor3mf(tetra, [0, 1, 2, 0, 3, 1, 1, 3, 2, 2, 3, 0]).triangles).toHaveLength(12)
    expect(() => closedMeshFor3mf(tetra, [0, 1, 2, 0, 3, 1])).toThrow(ExportError)
  })

  it('refuses to export nothing', async () => {
    const doc = setHidden(design(), ['g', 'ball'], true)
    await expect(newApi().exportStl(doc)).rejects.toThrow("There's nothing to export")
  })

  it('refuses to export a part with a problem', async () => {
    const doc = addNode(createEmptyDocument(), shape('ring', 'torus', { diameter: 10, thickness: 10 }))
    await expect(newApi().exportStl(doc)).rejects.toThrow('"ring" has a problem')
  })

  it('exports STEP', async () => {
    const doc = addNode(createEmptyDocument(), createShapeNode({ id: 'a', shapeType: 'box', name: 'Box', params: {}, color: '#f00' }))
    const bytes = await newApi().exportStep(doc)
    expect(new TextDecoder().decode(bytes.slice(0, 12))).toBe('ISO-10303-21')
  })

  it('includes modifier warnings in a rebuild', async () => {
    const base = addNode(createEmptyDocument(), createShapeNode({ id: 's', shapeType: 'sphere', name: 'Ball', params: {}, color: '#f00' }))
    const { doc, modifierId } = addModifier(base, 's', 'fillet')
    const result = await newApi().rebuild(doc)
    expect(result.warnings).toEqual({ s: { [modifierId]: 'No edges match, so this does nothing yet.' } })
  })

  it('explains edge-picking problems in plain words', async () => {
    const doc = addNode(createEmptyDocument(), createShapeNode({ id: 'a', shapeType: 'box', name: 'Box', params: {}, color: '#f00' }))
    await expect(newApi().edgeCandidates(doc, 'a', 'deadbeef')).rejects.toThrow('Only Round edges and Bevel edges')
  })
})

describe("designs carrying Kade's shapes (a fresh worker, an empty library)", () => {
  const ROBOT = "export default { name: 'Robot', settings: { size: { type: 'mm', default: 20 } }, build({ size }, cad) { return cad.box(size, size, size).add(cad.sphere(size).move(0, 0, size)) } }"
  const carrying = (code: string): BloKadeDocument => {
    const robot = createShapeNode({ id: 'robot', shapeType: 'my-robot0001', name: 'Robot', params: { size: 10 }, color: '#fff' })
    const doc = addNode(addNode(createEmptyDocument('Robots'), robot), shape('box', 'box', { width: 10, depth: 10, height: 10 }, [30, 0, 0]))
    return { ...doc, plugins: { 'my-robot0001': { name: 'Robot', code } } }
  }

  it('builds the carried shape', async () => {
    const result = await newApi().rebuild(carrying(ROBOT))
    expect(result.nodes.robot?.status).toBe('ok')
    expect(result.nodes.box?.status).toBe('ok')
  })
  it('exports a design that carries a shape', async () => {
    expect((await newApi().exportStl(carrying(ROBOT))).byteLength).toBeGreaterThan(84)
  })
  it('fails only the part whose carried code has a problem', async () => {
    const result = await newApi().rebuild(carrying("export default { name: 'Robot', build(s, cad) { return cad.box(-1, 1, 1) } }"))
    const robot = result.nodes.robot
    expect(robot?.status === 'error' && robot.message).toBe("Robot couldn't be built: Line 1: Sizes must be bigger than 0 — width was -1")
    expect(result.nodes.box?.status).toBe('ok')
  })
  it('explains carried code that does not even load', async () => {
    const result = await newApi().rebuild(carrying("export default { name: 'Robot' "))
    const robot = result.nodes.robot
    expect(robot?.status === 'error' && robot.message).toMatch(/^Robot couldn't be built: Line 1: something here doesn't look right/)
  })
  it('inspects code', async () => {
    await expect(newApi().inspect(ROBOT)).resolves.toMatchObject({ ok: true, meta: { name: 'Robot' } })
  })
})
