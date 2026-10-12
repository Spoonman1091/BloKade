import { measureVolume } from 'replicad'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { loadTestFont } from '../../geometry/testing/font-node'
import { initTestOC } from '../../geometry/testing/oc-node'
import { createCadToolkit } from '../cad'
import { setFontFailed } from '../font'
import { registry } from '../index'
import { resolveParams } from '../params'

beforeAll(async () => {
  await initTestOC()
  await loadTestFont()
})

afterEach(() => setFontFailed(false))

function textPlugin() {
  const plugin = registry.get('text')
  if (!plugin) throw new Error('missing text plugin')
  return plugin
}
const build = (raw: Readonly<Record<string, unknown>>) => textPlugin().build(resolveParams(textPlugin(), raw), createCadToolkit())

describe('Text shape', () => {
  it('builds raised letters centered on X/Y and sitting on the ground', () => {
    const shape = build({})
    const [[x0, y0, z0], [x1, y1, z1]] = shape.boundingBox.bounds
    expect(measureVolume(shape)).toBeGreaterThan(10)
    expect(z0).toBeCloseTo(0, 5)
    expect(z1).toBeCloseTo(3, 5)
    expect(x0 + x1).toBeCloseTo(0, 4)
    expect(y0 + y1).toBeCloseTo(0, 4)
    expect(x1 - x0).toBeGreaterThan(y1 - y0)
  })

  it('asks for letters when the text is blank (Review Focus 4)', () => {
    expect(() => build({ text: '   ' })).toThrow('Type some letters first.')
  })

  it('copes with letters the font does not have (Review Focus 4)', () => {
    try {
      expect(measureVolume(build({ text: '🙂' }))).toBeGreaterThan(0)
    } catch (error) {
      expect((error as Error).message).toContain("can't make 3D letters")
    }
  })

  it('explains when the font is not loaded yet', () => {
    const cad = createCadToolkit()
    expect(() => cad.text('Hi', 10, 2, 'not-a-font')).toThrow("The letter shapes aren't ready yet")
  })

  it('says to reload when the font failed to load for good', () => {
    setFontFailed(true)
    const cad = createCadToolkit()
    expect(() => cad.text('Hi', 10, 2, 'not-a-font')).toThrow("The letter font couldn't load. Reload BloKade to try again.")
  })
})
