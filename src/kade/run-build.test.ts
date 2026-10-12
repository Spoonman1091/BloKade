import { beforeAll, describe, expect, it } from 'vitest'
import { initTestOC } from '../geometry/testing/oc-node'
import { readShapeDefinition, type ShapeBuild } from './definition'
import { ShapeTracker } from './part'
import { MISSING_RETURN, RETURNED_OUTLINE, runKadeBuild } from './run-build'
import { fileModuleLoader } from './testing/file-loader'
import { ASYNC_BUILD, KEPT_PART } from './messages'

beforeAll(initTestOC)

/** Lines are numbered from 1; build's body starts on line 4. */
const shapeCode = (...body: string[]) =>
  ['export default {', "  name: 'Test',", '  build({ w }, cad) {', ...body.map((l) => `    ${l}`), '  },', '}'].join('\n')

async function load(code: string): Promise<{ build: ShapeBuild; source: string }> {
  const loaded = await fileModuleLoader(code)
  const definition = readShapeDefinition(loaded.exports)
  if (!definition.ok) throw new Error(definition.error)
  return { build: definition.value.build, source: loaded.source }
}

describe('runKadeBuild', () => {
  it('builds the part and frees everything else', async () => {
    const { build, source } = await load(shapeCode('const a = cad.box(w, 10, 10)', 'return a.add(cad.cylinder(5, 20)).move(0, 0, 1)'))
    const tracker = new ShapeTracker()
    const shape = runKadeBuild(build, { w: 20 }, source, undefined, tracker)
    expect(shape.boundingBox.bounds[0]?.[2]).toBeCloseTo(1)
    expect(tracker.counts()).toEqual({ made: 4, held: 0 })
    shape.delete()
  })
  it('says what to do when build forgets to return a part', async () => {
    const { build, source } = await load(shapeCode('cad.box(w, 10, 10)'))
    expect(() => runKadeBuild(build, { w: 20 }, source)).toThrow(MISSING_RETURN)
  })
  it('says what to do when build returns an outline', async () => {
    const { build, source } = await load(shapeCode('return cad.rect(w, 10)'))
    expect(() => runKadeBuild(build, { w: 20 }, source)).toThrow(RETURNED_OUTLINE)
  })
  it('adds the line to errors from Kade\'s code', async () => {
    const misspelt = await load(shapeCode('const width = w', 'return cad.box(widht, 10, 5)'))
    expect(() => runKadeBuild(misspelt.build, { w: 20 }, misspelt.source)).toThrow('Line 5: there\'s nothing called "widht" — check the spelling.')
    const negative = await load(shapeCode('return cad.box(-3, 10, 5)'))
    expect(() => runKadeBuild(negative.build, { w: 20 }, negative.source)).toThrow('Line 4: Sizes must be bigger than 0 — width was -3')
  })
  it('frees every shape when the build fails part way', async () => {
    const { build, source } = await load(shapeCode('const a = cad.box(10, 10, 10)', 'const b = a.move(5, 0, 0)', 'return b.move(1, 2)'))
    const tracker = new ShapeTracker()
    expect(() => runKadeBuild(build, { w: 1 }, source, undefined, tracker)).toThrow('Line 6: .move needs 3 numbers')
    expect(tracker.counts()).toEqual({ made: 2, held: 0 })
  })
  it('says build() can\'t be async, and frees what an async build makes later', async () => {
    const code = ['export default {', "  name: 'Test',", '  async build({ w }, cad) {', '    await null', '    return cad.box(w, 10, 10)', '  },', '}'].join('\n')
    const { build, source } = await load(code)
    const tracker = new ShapeTracker()
    expect(() => runKadeBuild(build, { w: 20 }, source, undefined, tracker)).toThrow(ASYNC_BUILD)
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(tracker.counts()).toEqual({ made: 1, held: 0 })
  })
  it('lets an async build that fails go quietly', async () => {
    const code = ['export default {', "  name: 'Test',", '  async build() {', "    throw new Error('oops')", '  },', '}'].join('\n')
    const { build, source } = await load(code)
    expect(() => runKadeBuild(build, {}, source)).toThrow(ASYNC_BUILD)
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
  it('gives each build its own copy of a part kept from an earlier build', async () => {
    const code = ['let kept = null', 'export default {', "  name: 'Test',", '  build({ w }, cad) {', '    kept = kept ?? cad.box(w, 10, 10)', '    return kept', '  },', '}'].join('\n')
    const { build, source } = await load(code)
    const first = runKadeBuild(build, { w: 20 }, source)
    const tracker = new ShapeTracker()
    const second = runKadeBuild(build, { w: 20 }, source, undefined, tracker)
    expect(second).not.toBe(first)
    expect(tracker.counts()).toEqual({ made: 1, held: 0 })
    first.delete()
    expect(second.boundingBox.bounds[1]?.[0]).toBeCloseTo(10)
    second.delete()
  })
  it('says to make parts inside build() when a kept part is changed in a later build', async () => {
    const code = ['let kept = null', 'export default {', "  name: 'Test',", '  build({ w }, cad) {', '    const first = !kept', '    kept = kept ?? cad.box(w, 10, 10)', '    return first ? kept : kept.move(1, 0, 0)', '  },', '}'].join('\n')
    const { build, source } = await load(code)
    const first = runKadeBuild(build, { w: 20 }, source)
    expect(() => runKadeBuild(build, { w: 20 }, source)).toThrow(`Line 7: ${KEPT_PART}`)
    first.delete()
  })
})
