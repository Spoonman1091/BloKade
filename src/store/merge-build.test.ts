import { describe, expect, it } from 'vitest'
import type { MeshData } from '../geometry/types'
import { mergeBuild } from './merge-build'

const mesh = (n: number): MeshData => ({
  positions: new Float32Array([n]), normals: new Float32Array(), indices: new Uint32Array(), edges: new Float32Array(),
})

describe('mergeBuild', () => {
  it('stores fresh meshes and errors', () => {
    const out = mergeBuild({}, { nodes: { a: { status: 'ok', mesh: mesh(1) }, b: { status: 'error', message: 'oops' } } })
    expect(out.meshes.a).toEqual({ mesh: mesh(1), stale: false })
    expect(out.meshes.b).toBeUndefined()
    expect(out.errors).toEqual({ b: 'oops' })
  })

  it('keeps the last good mesh, marked stale, when a part fails', () => {
    const prev = { a: { mesh: mesh(1), stale: false } }
    const out = mergeBuild(prev, { nodes: { a: { status: 'error', message: 'bad' } } })
    expect(out.meshes.a).toEqual({ mesh: mesh(1), stale: true })
  })

  it('drops parts that are gone', () => {
    const prev = { a: { mesh: mesh(1), stale: false } }
    expect(mergeBuild(prev, { nodes: {} }).meshes).toEqual({})
  })
})
