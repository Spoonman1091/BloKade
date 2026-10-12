import { beforeAll, describe, expect, it, vi } from 'vitest'
import { createEmptyDocument } from '../document/factory'
import { MAX_CARRIED_SHAPES } from '../document/types'
import { initTestOC } from '../geometry/testing/oc-node'
import { registry } from '../plugins/index'
import { NO_BUILD } from './definition'
import { codeHash } from './hash'
import { KadeShapes } from './kade-shapes'
import { CHECK_FAILED, CODE_TOO_BIG } from './messages'
import type { ModuleLoader } from './module-loader'
import { fileModuleLoader } from './testing/file-loader'

beforeAll(initTestOC)

const ROBOT = ["export default {", "  name: 'Robot',", "  icon: '🤖',", "  settings: { size: { type: 'mm', default: 20 } },",
  '  build({ size }, cad) { return cad.box(size, size, size) },', '}'].join('\n')

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
    const shapes = new KadeShapes(load, registry, 2)
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
    const doc = { ...createEmptyDocument(), plugins: { 'my-robot0001': { name: 'Robot', code: ROBOT } } }
    const shapes = await new KadeShapes(fileModuleLoader, registry).registryFor(doc)
    expect(shapes.get('my-robot0001')).toMatchObject({ name: 'Robot', toolkit: 'kade', revision: codeHash(ROBOT) })
    expect(shapes.list()).toHaveLength(registry.list().length + 1)
    expect(shapes.get('box')).toBe(registry.get('box'))
  })
  it('keeps the built-in shape when a design carries the same id', async () => {
    const doc = { ...createEmptyDocument(), plugins: { box: { name: 'Robot', code: ROBOT } } }
    const shapes = await new KadeShapes(fileModuleLoader, registry).registryFor(doc)
    expect(shapes.get('box')).toBe(registry.get('box'))
  })
  it('gives a carried shape whose code has a problem a build that explains it', async () => {
    const doc = { ...createEmptyDocument(), plugins: { 'my-robot0001': { name: 'Robot', code: "export default { name: 'A' }" } } }
    const robot = (await new KadeShapes(fileModuleLoader, registry).registryFor(doc)).get('my-robot0001')
    expect(robot).toMatchObject({ name: 'Robot', toolkit: 'kade', params: {} })
    expect(() => robot?.build({}, {} as never)).toThrow(NO_BUILD)
  })
  it('loads each of the most shapes a design can carry only once across rebuilds', async () => {
    const { load, counts } = counting()
    const shapes = new KadeShapes(load, registry)
    const plugins = Object.fromEntries(Array.from({ length: MAX_CARRIED_SHAPES }, (_, n) =>
      [`my-shape${n}`, { name: `S${n}`, code: `export default { name: 'S${n}', build(s, cad) { return cad.box(1, 1, 1) } }` }]))
    const doc = { ...createEmptyDocument(), plugins }
    await shapes.registryFor(doc)
    await shapes.registryFor(doc)
    await new Promise((r) => setTimeout(r, 0))
    expect(counts.loads).toBe(MAX_CARRIED_SHAPES)
    expect(counts.disposed).toBe(0)
  })
  it('hands back the built-in list for a design that carries nothing', async () => {
    expect(await new KadeShapes(fileModuleLoader, registry).registryFor(createEmptyDocument())).toBe(registry)
  })
})
