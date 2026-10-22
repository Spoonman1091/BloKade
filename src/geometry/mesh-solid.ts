import { cast, getOC, measureVolume, type Shape3D } from 'replicad'

const STL_HEADER_BYTES = 80
const STL_TRIANGLE_BYTES = 50

let fileCounter = 0

type OC = ReturnType<typeof getOC>
type Disposable = { delete(): void }

/** A binary STL holding the triangles; OpenCascade computes its own normals, so those are left zero. */
function binaryStl(vertices: ArrayLike<number>, triangles: ArrayLike<number>): Uint8Array {
  const count = Math.floor(triangles.length / 3)
  const bytes = new Uint8Array(STL_HEADER_BYTES + 4 + count * STL_TRIANGLE_BYTES)
  const view = new DataView(bytes.buffer)
  view.setUint32(STL_HEADER_BYTES, count, true)
  for (let t = 0; t < count; t++) {
    const base = STL_HEADER_BYTES + 4 + t * STL_TRIANGLE_BYTES + 12
    for (let corner = 0; corner < 3; corner++) {
      const vertex = (triangles[t * 3 + corner] ?? 0) * 3
      for (let axis = 0; axis < 3; axis++) view.setFloat32(base + (corner * 3 + axis) * 4, vertices[vertex + axis] ?? 0, true)
    }
  }
  return bytes
}

/** Distance within which triangle corners count as one point when stitching faces together. */
const SEW_TOLERANCE = 1e-6

/** Reads the triangles into OpenCascade, one face per triangle, through its virtual file system. */
function readFaces(oc: OC, bytes: Uint8Array, into: InstanceType<OC['TopoDS_Shape']>): boolean {
  const name = `blokade-mesh-${fileCounter++}.stl`
  const reader = new oc.StlAPI_Reader()
  oc.FS.writeFile(`/${name}`, bytes)
  try {
    return reader.Read(into, name)
  } finally {
    oc.FS.unlink(`/${name}`)
    reader.delete()
  }
}

/** The first shell inside a shape, or null if there is none. The caller frees it. */
function firstShell(oc: OC, shape: InstanceType<OC['TopoDS_Shape']>, track: Disposable[]) {
  const explorer = new oc.TopExp_Explorer(shape, oc.TopAbs_ShapeEnum.TopAbs_SHELL, oc.TopAbs_ShapeEnum.TopAbs_SHAPE)
  track.push(explorer)
  if (!explorer.More()) return null
  const current = explorer.Current()
  track.push(current)
  const shell = oc.TopoDS.Shell(current)
  track.push(shell)
  return shell
}

/** Stitches the triangle faces along their shared edges into one shell, if they close up. */
function sewShell(oc: OC, faces: InstanceType<OC['TopoDS_Shape']>, track: Disposable[]) {
  const sewing = new oc.BRepBuilderAPI_Sewing(SEW_TOLERANCE, true, true, true, false)
  track.push(sewing)
  sewing.Add(faces)
  sewing.Perform()
  const sewn = sewing.SewedShape()
  track.push(sewn)
  return firstShell(oc, sewn, track)
}

/** Wraps the solid, turning it right way out if the mesh was wound inside-out (negative volume). */
function rightWayOut(oc: OC, solid: InstanceType<OC['TopoDS_Solid']>): Shape3D {
  const shape = cast(solid) as Shape3D
  if (measureVolume(shape) >= 0) return shape
  shape.delete()
  const flipped = solid.Reversed()
  const copy = oc.TopoDS.Solid(flipped)
  const result = cast(copy) as Shape3D
  flipped.delete()
  copy.delete()
  return result
}

/** Turns triangles (flat x, y, z vertices and three vertex indices per triangle) into a solid. */
export function meshSolid(vertices: ArrayLike<number>, triangles: ArrayLike<number>): Shape3D {
  if (triangles.length < 3) throw new Error('This model has no shape in it.')
  const oc = getOC()
  const track: Disposable[] = []
  try {
    const faces = new oc.TopoDS_Shape()
    track.push(faces)
    if (!readFaces(oc, binaryStl(vertices, triangles), faces)) throw new Error('This model could not be read.')
    const shell = sewShell(oc, faces, track)
    if (!shell) throw new Error('This model has no shape in it.')
    const unify = new oc.ShapeUpgrade_UnifySameDomain(shell, true, true, false)
    track.push(unify)
    unify.Build()
    const unified = unify.Shape()
    track.push(unified)
    const merged = firstShell(oc, unified, track) ?? shell
    const maker = new oc.BRepBuilderAPI_MakeSolid()
    track.push(maker)
    maker.Add(merged)
    const solid = maker.Solid()
    track.push(solid)
    return rightWayOut(oc, solid)
  } finally {
    track.forEach((d) => d.delete())
  }
}
