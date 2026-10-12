import { measureVolume, type Shape3D } from 'replicad'
import { beforeAll, describe, expect, it } from 'vitest'
import { initTestOC } from '../../geometry/testing/oc-node'
import { createCadToolkit } from '../cad'
import { registry } from '../index'
import { defaultParams, resolveParams } from '../params'

beforeAll(initTestOC)

export function build(id: string, overrides: Record<string, number | string> = {}): Shape3D {
  const plugin = registry.get(id)
  if (!plugin) throw new Error(`missing plugin ${id}`)
  return plugin.build(resolveParams(plugin, { ...defaultParams(plugin), ...overrides }), createCadToolkit())
}

export function volumeOf(shape: Shape3D): number {
  try {
    return measureVolume(shape)
  } finally {
    shape.delete()
  }
}

describe('peg and socket', () => {
  it('builds round and square pegs', () => {
    expect(volumeOf(build('peg'))).toBeCloseTo(Math.PI * 16 * 10, 1)
    expect(volumeOf(build('peg', { shape: 'square' }))).toBeCloseTo(640, 3)
  })

  it('makes the socket bigger than the peg by the extra room on every side', () => {
    expect(volumeOf(build('socket', { clearance: 0.2 }))).toBeCloseTo(Math.PI * 4.2 ** 2 * 11, 1)
    expect(volumeOf(build('socket', { shape: 'square', clearance: 0.5 }))).toBeCloseTo(9 * 9 * 11, 3)
  })

  it('starts sockets as holes that follow fit', () => {
    const socket = registry.get('socket')
    expect(socket?.mode).toBe('hole')
    expect(socket?.params.clearance).toMatchObject({ formula: 'fit' })
    expect(registry.get('peg')?.mode).toBeUndefined()
  })
})
