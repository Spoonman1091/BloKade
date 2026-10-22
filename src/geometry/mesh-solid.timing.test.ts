import { beforeAll, describe, it } from 'vitest'
import { createEmptyDocument, createShapeNode } from '../document/factory'
import { addImportedPart } from '../document/models'
import { addNode, groupNodes, setMode } from '../document/ops'
import type { BloKadeDocument } from '../document/types'
import { MAX_IMPORT_TRIANGLES } from '../import/limits'
import { createCadToolkit } from '../plugins/cad'
import { registry } from '../plugins/index'
import { Evaluator } from './evaluate'
import { meshSolid } from './mesh-solid'
import { importInput, sphereMesh } from './testing/meshes'
import { initTestOC } from './testing/oc-node'

/** Triangle counts to time; a sphere with 2 * segments * (rings - 1) triangles, segments = 2 * rings. */
const COUNTS = [10_000, 20_000, 40_000]
/** A sphere with exactly MAX_IMPORT_TRIANGLES triangles (2 * segments * 50 rings). */
const LIMIT_SPHERE = sphereMesh(40, MAX_IMPORT_TRIANGLES / 100, 51)
/** The client's watchdog gives a build 30 s (src/geometry/client.ts); the timings must stay under it. */
const WATCHDOG_MS = 30_000

/*
 * Measured in Node (Apple silicon), BLOKADE_TIMING=1:
 *   MAX_IMPORT_TRIANGLES 10,000: two imported solids fused in a group 10.7 s; five overlapping copies fused + one hole 53.7 s (too slow)
 *   MAX_IMPORT_TRIANGLES  5,000: two imported solids fused in a group  3.7 s; five overlapping copies fused + one hole 23.1 s
 * The limit was lowered to 5,000 for that reason. Stored models up to MAX_STORED_TRIANGLES (10,000) still open.
 */

const timed = (label: string, work: () => void): number => {
  const start = performance.now()
  work()
  const ms = Math.round(performance.now() - start)
  console.info(`${label}: ${ms} ms`)
  return ms
}

/** Two overlapping imported spheres in a group, plus an optional hole through the first. */
function twoSpheres(): BloKadeDocument {
  const input = importInput(LIMIT_SPHERE)
  const first = addImportedPart(createEmptyDocument(), { ...input, name: 'A' })
  const second = addImportedPart(first.doc, { ...input, name: 'B', position: [15, 0, 0] })
  return groupNodes(second.doc, [first.id, second.id], 'g').doc
}

/**
 * Five overlapping copies of one imported solid in a group, all cut by one hole. (A linearPattern modifier is no use
 * here: it refuses any part with more than 2000 / copies faces, so a 10,000-face model can't be repeated at all.)
 */
function cutAndPlacedFive(): BloKadeDocument {
  const input = importInput(LIMIT_SPHERE)
  const first = addImportedPart(createEmptyDocument(), input)
  const copies = [1, 2, 3, 4].reduce((acc, i) => {
    const added = addImportedPart(acc.doc, { ...input, position: [i * 20, 0, 0] })
    return { doc: added.doc, ids: [...acc.ids, added.id] }
  }, { doc: first.doc, ids: [first.id] })
  const hole = createShapeNode({ id: 'hole', shapeType: 'cylinder', name: 'hole', params: { diameter: 10, height: 60 }, color: '#fff', position: [40, 0, -10] })
  const withHole = setMode(addNode(copies.doc, hole), ['hole'], 'hole')
  return groupNodes(withHole, [...copies.ids, 'hole'], 'g').doc
}

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

  it(`fuses two imported solids of ${MAX_IMPORT_TRIANGLES} triangles in a group`, () => {
    const doc = twoSpheres()
    const ms = timed('group fuse of two imported solids', () => { new Evaluator(registry, createCadToolkit()).local(doc, 'g') })
    if (ms > WATCHDOG_MS) throw new Error(`Took ${ms} ms; that is past the watchdog`)
  }, 300_000)

  it(`fuses five overlapping imported solids of ${MAX_IMPORT_TRIANGLES} triangles and cuts them with a hole`, () => {
    const doc = cutAndPlacedFive()
    const ms = timed('five placed imported solids fused and cut', () => { new Evaluator(registry, createCadToolkit()).local(doc, 'g') })
    if (ms > WATCHDOG_MS) throw new Error(`Took ${ms} ms; that is past the watchdog`)
  }, 300_000)
})
