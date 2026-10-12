import { Matrix4 } from 'three'
import type { ParamValue } from '../../../document/types'
import { createGeometryApi } from '../../../geometry/api'
import { Evaluator } from '../../../geometry/evaluate'
import { createCadToolkit } from '../../../plugins/cad'
import { registry } from '../../../plugins/index'
import { meshBox } from '../../../viewport/bounds'
import { codeViewOf, type CodeView } from '../../code-view'
import { KadeShapes } from '../../kade-shapes'
import { previewDocument, PREVIEW_ID } from '../../preview'
import { fileModuleLoader } from '../../testing/file-loader'

const shapes = new KadeShapes(fileModuleLoader, registry)
const api = createGeometryApi(new Evaluator(registry, createCadToolkit()), shapes)

/** Node tests: the CodeView a lesson step sees once Kade's code has settled and the preview has built it. */
export async function codeViewFor(code: string, values: Readonly<Record<string, ParamValue>> = {}): Promise<CodeView> {
  const shape = { id: 'my-lesson0001', name: 'Lesson', code, updatedAt: 0 }
  const inspect = await shapes.inspect(code)
  const built = (await api.rebuild(previewDocument(shape, values), 'preview')).nodes[PREVIEW_ID]
  return codeViewOf({
    shape, typing: false, inspect, builtFor: { shapeId: shape.id, code },
    bounds: built?.status === 'ok' ? meshBox(built.mesh.positions, new Matrix4()) : null,
    buildError: built?.status === 'error' ? built.message : undefined,
  })
}
