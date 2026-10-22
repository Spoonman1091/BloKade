import { importInput, type TestMesh } from '../../geometry/testing/meshes'
import type { PreparedModel } from '../../import/prepare'

/** A prepared model for tests, made from a test mesh. */
export function preparedModel(mesh: TestMesh, extra: Partial<PreparedModel> = {}): PreparedModel {
  const { vertices, triangles, size } = importInput(mesh)
  return { vertices, triangles, size, triangleCount: triangles.length / 3, simplified: false, hasGaps: false, ...extra }
}
