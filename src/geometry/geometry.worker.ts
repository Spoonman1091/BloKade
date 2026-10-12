import * as Comlink from 'comlink'
import fontUrl from '../assets/fonts/AtkinsonHyperlegible-Bold.ttf?url'
import { createCadToolkit } from '../plugins/cad'
import { registerFont } from '../plugins/font'
import { registry } from '../plugins/index'
import { createGeometryApi } from './api'
import { Evaluator } from './evaluate'
import { initBrowserOC } from './oc-browser'
import type { GeometryApi } from './types'

/** A missing font only breaks Text shapes (they show a warning); every other shape still builds. */
async function loadLetters(): Promise<void> {
  try {
    const response = await fetch(fontUrl)
    await registerFont(await response.arrayBuffer())
  } catch (error) {
    console.error('Could not load the letter font; Text shapes will show a warning.', error)
  }
}

const apiReady = Promise.all([initBrowserOC(), loadLetters()])
  .then(() => createGeometryApi(new Evaluator(registry, createCadToolkit())))

const api: GeometryApi = {
  rebuild: async (doc) => (await apiReady).rebuild(doc),
  exportStl: async (doc, ids) => (await apiReady).exportStl(doc, ids),
  export3mf: async (doc, ids) => (await apiReady).export3mf(doc, ids),
}

Comlink.expose(api)
