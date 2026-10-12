import { beforeAll, describe, expect, it } from 'vitest'
import { loadTestFont } from '../geometry/testing/font-node'
import { initTestOC } from '../geometry/testing/oc-node'
import { CAD_COMMANDS, type CadCommand } from './commands'
import { Outline, OUTLINE_STEPS, Part, PART_STEPS, ShapeTracker } from './part'
import { buildKadeCode } from './testing/build-code'
import { createKadeToolkit } from './toolkit'

beforeAll(async () => {
  await initTestOC()
  await loadTestFont()
})

const names = (on: CadCommand['on']) => CAD_COMMANDS.filter((c) => c.on === on).map((c) => c.name).sort()

describe('the ❓ Commands list', () => {
  it('lists exactly the commands the toolkit, parts and outlines have', () => {
    expect(names('cad')).toEqual(Object.keys(createKadeToolkit(new ShapeTracker())).sort())
    expect(names('part')).toEqual([...PART_STEPS].sort())
    expect(names('outline')).toEqual([...OUTLINE_STEPS].sort())
    for (const step of PART_STEPS) expect(typeof Part.prototype[step]).toBe('function')
    for (const step of OUTLINE_STEPS) expect(typeof Outline.prototype[step]).toBe('function')
  })
  it('has no duplicate names and keeps every line short', () => {
    expect(new Set(CAD_COMMANDS.map((c) => `${c.on}.${c.name}`)).size).toBe(CAD_COMMANDS.length)
    for (const c of CAD_COMMANDS) expect(c.does.length).toBeLessThanOrEqual(90)
  })
  it.each(CAD_COMMANDS.map((c) => [c.call, c] as const))('%s: its example works', async (_call, command) => {
    const code = `export default { name: 'Example', build(s, cad) { const value = ${command.example}; return typeof value === 'number' ? cad.box(1, 1, 1) : value } }`
    const built = await buildKadeCode(code)
    built.dispose()
  })
})
