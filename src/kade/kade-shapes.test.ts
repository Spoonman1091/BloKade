import { beforeAll, describe, expect, it, vi } from 'vitest'
import { createEmptyDocument, createShapeNode } from '../document/factory'
import { addNode } from '../document/ops'
import { MAX_CARRIED_SHAPES, type BloKadeDocument, type CarriedShape } from '../document/types'
import { initTestOC } from '../geometry/testing/oc-node'
import { registry } from '../plugins/index'
import { NO_BUILD } from './definition'
import { codeHash } from './hash'
import { KadeShapes } from './kade-shapes'
import { CHECK_FAILED, CODE_TOO_BIG, TOO_LONG } from './messages'
import { runKadeBuild, type KadeBuild } from './run-build'
import type { ModuleLoader } from './module-loader'
import { fileModuleLoader } from './testing/file-loader'

beforeAll(initTestOC)

const ROBOT = ["export default {", "  name: 'Robot',", "  icon: '🤖',", "  settings: { size: { type: 'mm', default: 20 } },",
  '  build({ size }, cad) { return cad.box(size, size, size) },', '}'].join('\n')

/** A design with one part for each carried shape. */
function carrying(plugins: Record<string, CarriedShape>): BloKadeDocument {
  return Object.keys(plugins).reduce((d, shapeType, n) =>
    addNode(d, createShapeNode({ id: `p${n}`, shapeType, name: shapeType, params: {}, color: '#fff' })), { ...createEmptyDocument(), plugins })
}

function counting() {
  const counts = { loads: 0, disposed: 0 }
  const load: ModuleLoader = async (code) => {
    counts.loads += 1
    const loaded = await fileModuleLoader(code)
    return { ...loaded, dispose: () => { counts.disposed += 1; loaded.dispose() } }
  }
  return { load, counts }
}

describe('KadeShapes.inspect', () => {
  it('reports the name, icon and settings, and loads each code only once', async () => {
    const { load, counts } = counting()
    const shapes = new KadeShapes(load, registry)
    const expected = { ok: true, meta: { name: 'Robot', icon: '🤖', params: { size: { type: 'mm', default: 20, label: 'size' } } } }
    await expect(shapes.inspect(ROBOT)).resolves.toEqual(expected)
    await expect(shapes.inspect(ROBOT)).resolves.toEqual(expected)
    expect(counts.loads).toBe(1)
  })
  it('finds syntax mistakes and over-long code without running anything', async () => {
    const { load, counts } = counting()
    const shapes = new KadeShapes(load, registry)
    const syntax = await shapes.inspect("export default { name: 'A'")
    expect(!syntax.ok && syntax.problem).toMatch(/^Line 1: something here doesn't look right/)
    await expect(shapes.inspect('x'.repeat(50_001))).resolves.toEqual({ ok: false, problem: CODE_TOO_BIG })
    expect(counts.loads).toBe(0)
  })
  it('explains errors while the code loads, with the line', async () => {
    const shapes = new KadeShapes(fileModuleLoader, registry)
    await expect(shapes.inspect('const size = 1\nconst x = nope\nexport default {}'))
      .resolves.toEqual({ ok: false, problem: 'Line 2: there\'s nothing called "nope" — check the spelling.' })
  })
  it('explains a definition problem and lets go of the module', async () => {
    const { load, counts } = counting()
    await expect(new KadeShapes(load, registry).inspect("export default { name: 'A' }")).resolves.toEqual({ ok: false, problem: NO_BUILD })
    expect(counts.disposed).toBe(1)
  })
  it('explains a definition that throws while it is read, and lets go of the module', async () => {
    const { load, counts } = counting()
    const code = "export default {\n  get name() { return nope },\n  build(s, cad) { return cad.box(1, 1, 1) },\n}"
    await expect(new KadeShapes(load, registry).inspect(code))
      .resolves.toEqual({ ok: false, problem: 'Line 2: there\'s nothing called "nope" — check the spelling.' })
    expect(counts.disposed).toBe(1)
  })
  it('turns a loader that fails unexpectedly into a friendly problem', async () => {
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    try {
      const broken: ModuleLoader = async () => { throw new Error('disk on fire') }
      await expect(new KadeShapes(broken, registry).inspect('export default {}')).resolves.toEqual({ ok: false, problem: CHECK_FAILED })
    } finally {
      quiet.mockRestore()
    }
  })
  it('forgets the oldest code past its limit', async () => {
    const { load, counts } = counting()
    const shapes = new KadeShapes(load, registry, undefined, 2)
    const code = (n: number) => `export default { name: 'S${n}', build(s, cad) { return cad.box(1, 1, 1) } }`
    await shapes.inspect(code(1))
    await shapes.inspect(code(2))
    await shapes.inspect(code(3))
    await new Promise((r) => setTimeout(r, 0))
    expect(counts.disposed).toBe(1)
    await shapes.inspect(code(1))
    expect(counts.loads).toBe(4)
  })
})

describe('KadeShapes.registryFor', () => {
  it('adds the shapes a design carries to the built-in ones', async () => {
    const doc = carrying({ 'my-robot0001': { name: 'Robot', code: ROBOT } })
    const shapes = await new KadeShapes(fileModuleLoader, registry).registryFor(doc)
    expect(shapes.get('my-robot0001')).toMatchObject({ name: 'Robot', toolkit: 'kade', revision: codeHash(ROBOT) })
    expect(shapes.list()).toHaveLength(registry.list().length + 1)
    expect(shapes.get('box')).toBe(registry.get('box'))
  })
  it('keeps the built-in shape when a design carries the same id', async () => {
    const doc = carrying({ box: { name: 'Robot', code: ROBOT } })
    const shapes = await new KadeShapes(fileModuleLoader, registry).registryFor(doc)
    expect(shapes.get('box')).toBe(registry.get('box'))
  })
  it('gives a carried shape whose code has a problem a build that explains it', async () => {
    const doc = carrying({ 'my-robot0001': { name: 'Robot', code: "export default { name: 'A' }" } })
    const robot = (await new KadeShapes(fileModuleLoader, registry).registryFor(doc)).get('my-robot0001')
    expect(robot).toMatchObject({ name: 'Robot', toolkit: 'kade', params: {} })
    expect(() => robot?.build({}, {} as never)).toThrow(NO_BUILD)
  })
  it('loads each of the most shapes a design can carry only once across rebuilds', async () => {
    const { load, counts } = counting()
    const shapes = new KadeShapes(load, registry)
    const plugins = Object.fromEntries(Array.from({ length: MAX_CARRIED_SHAPES }, (_, n) =>
      [`my-shape${n}`, { name: `S${n}`, code: `export default { name: 'S${n}', build(s, cad) { return cad.box(1, 1, 1) } }` }]))
    const doc = carrying(plugins)
    await shapes.registryFor(doc)
    await shapes.registryFor(doc)
    await new Promise((r) => setTimeout(r, 0))
    expect(counts.loads).toBe(MAX_CARRIED_SHAPES)
    expect(counts.disposed).toBe(0)
  })
  it('hands back the built-in list for a design that carries nothing', async () => {
    expect(await new KadeShapes(fileModuleLoader, registry).registryFor(createEmptyDocument())).toBe(registry)
  })
  it("doesn't load shapes no part uses", async () => {
    const { load, counts } = counting()
    const doc = { ...createEmptyDocument(), plugins: { 'my-robot0001': { name: 'Robot', code: ROBOT } } }
    expect(await new KadeShapes(load, registry).registryFor(doc)).toBe(registry)
    expect(counts.loads).toBe(0)
  })
})

describe('KadeShapes and stuck code', () => {
  const LOOP_AT_LOAD = "while (true) {}\nexport default { name: 'Loop', build(s, cad) { return cad.box(1, 1, 1) } }"
  const LOOP_IN_BUILD = "export default { name: 'Spin', build(s, cad) { while (true) {} } }"

  it('tells the page which code it is loading and building', async () => {
    const events: [string, boolean][] = []
    const shapes = new KadeShapes(fileModuleLoader, registry, (hash, running) => events.push([hash, running]))
    const doc = carrying({ 'my-robot0001': { name: 'Robot', code: ROBOT } })
    const robot = (await shapes.registryFor(doc)).get('my-robot0001')
    const hash = codeHash(ROBOT)
    expect(events).toEqual([[hash, true], [hash, false]])
    runKadeBuild(robot?.build as unknown as KadeBuild, { size: 5 }, null).delete()
    expect(events).toEqual([[hash, true], [hash, false], [hash, true], [hash, false]])
    expect(() => runKadeBuild(robot?.build as unknown as KadeBuild, { size: -1 }, null)).toThrow()
    expect(events.at(-1)).toEqual([hash, false])
  })
  it('loads one shape at a time', async () => {
    let loading = 0
    let most = 0
    const load: ModuleLoader = async (code) => {
      loading += 1
      most = Math.max(most, loading)
      try {
        return await fileModuleLoader(code)
      } finally {
        loading -= 1
      }
    }
    const code = (n: number) => `export default { name: 'S${n}', build(s, cad) { return cad.box(1, 1, 1) } }`
    await new KadeShapes(load, registry).registryFor(carrying({ 'my-a': { name: 'A', code: code(1) }, 'my-b': { name: 'B', code: code(2) } }))
    expect(most).toBe(1)
  })
  it('never loads or builds code that got a worker stuck before; it fails with TOO_LONG', async () => {
    const { load, counts } = counting()
    const shapes = new KadeShapes(load, registry)
    shapes.skip([codeHash(LOOP_AT_LOAD), codeHash(LOOP_IN_BUILD)])
    await expect(shapes.inspect(LOOP_AT_LOAD)).resolves.toEqual({ ok: false, problem: TOO_LONG })
    const found = await shapes.registryFor(carrying({ 'my-loop': { name: 'Loop', code: LOOP_AT_LOAD }, 'my-spin': { name: 'Spin', code: LOOP_IN_BUILD } }))
    expect(() => found.get('my-loop')?.build({}, {} as never)).toThrow(TOO_LONG)
    expect(() => found.get('my-spin')?.build({}, {} as never)).toThrow(TOO_LONG)
    expect(counts.loads).toBe(0)
  })
})
