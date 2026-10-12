import { measureVolume } from 'replicad'
import { beforeAll, describe, expect, it } from 'vitest'
import { initTestOC } from '../../geometry/testing/oc-node'
import { createCadToolkit } from '../cad'
import { pluginProblems, registry } from '../index'
import { defaultParams } from '../params'

beforeAll(initTestOC)

const expectedVolumes: Record<string, number> = {
  box: 8000,
  cylinder: Math.PI * 100 * 20,
  sphere: (4 / 3) * Math.PI * 1000,
  cone: (Math.PI * 100 * 20) / 3,
  wedge: 4000,
  torus: 2 * Math.PI ** 2 * 15 * 25,
}

describe('built-in shapes', () => {
  it('registers all six built-ins in palette order with no problems', () => {
    expect(pluginProblems).toEqual([])
    expect(registry.list().map((p) => p.id)).toEqual(['box', 'cylinder', 'sphere', 'cone', 'wedge', 'torus'])
  })

  it.each(Object.entries(expectedVolumes))('%s builds with its defaults', (id, volume) => {
    const plugin = registry.get(id)
    if (!plugin) throw new Error(`missing ${id}`)
    const shape = plugin.build(defaultParams(plugin), createCadToolkit())
    expect(measureVolume(shape)).toBeCloseTo(volume, 1)
    expect(shape.boundingBox.bounds[0][2]).toBeCloseTo(0, 5)
  })

  it('every size handle maps to a real parameter', () => {
    for (const plugin of registry.list()) {
      for (const target of Object.values(plugin.size ?? {})) expect(plugin.params).toHaveProperty(target as string)
    }
  })
})
