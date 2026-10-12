import * as Comlink from 'comlink'
import { createCadToolkit } from '../plugins/cad'
import { registry } from '../plugins/index'
import { createGeometryApi } from './api'
import { Evaluator } from './evaluate'
import { initBrowserOC } from './oc-browser'
import type { GeometryApi } from './types'

const apiReady = initBrowserOC().then(() => createGeometryApi(new Evaluator(registry, createCadToolkit())))

const api: GeometryApi = {
  rebuild: async (doc) => (await apiReady).rebuild(doc),
  exportStl: async (doc, ids) => (await apiReady).exportStl(doc, ids),
  export3mf: async (doc, ids) => (await apiReady).export3mf(doc, ids),
}

Comlink.expose(api)
