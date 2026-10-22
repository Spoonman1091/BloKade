import { beforeAll, describe, it } from 'vitest'
import { createCadToolkit } from '../plugins/cad'
import { meshSolid } from './mesh-solid'
import { sphereMesh } from './testing/meshes'
import { initTestOC } from './testing/oc-node'

/** Triangle counts to time; a sphere with 2 * segments * (rings - 1) triangles, segments = 2 * rings. */
const COUNTS = [10_000, 20_000, 40_000]

describe.skipIf(!process.env.BLOKADE_TIMING)('mesh solid timing', () => {
  beforeAll(initTestOC)

  it.each(COUNTS)('builds and cuts about %i triangles', (count) => {
    const rings = Math.round(Math.sqrt(count / 4)) + 1
    const { vertices, triangles } = sphereMesh(40, rings * 2, rings)
    const start = performance.now()
    const solid = meshSolid(vertices, triangles)
    solid.cut(createCadToolkit().cylinder(5, 60).translateZ(-10))
    console.info(`${count} (${triangles.length / 3} actual) triangles: ${Math.round(performance.now() - start)} ms`)
  }, 300_000)
})
