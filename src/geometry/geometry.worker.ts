import * as Comlink from 'comlink'
import fontUrl from '../assets/fonts/AtkinsonHyperlegible-Bold.ttf?url'
import { createCadToolkit } from '../plugins/cad'
import { registerFont, setFontFailed } from '../plugins/font'
import { registry } from '../plugins/index'
import { createGeometryApi } from './api'
import { Evaluator } from './evaluate'
import { initBrowserOC } from './oc-browser'
import type { GeometryApi } from './types'

/**
 * Loads the letter font in the background. A missing font only breaks Text shapes (they show a warning);
 * every other shape builds without waiting for it.
 */
async function loadLetters(): Promise<void> {
  try {
    const response = await fetch(fontUrl)
    if (!response.ok) throw new Error(`Font request failed with status ${response.status}`)
    await registerFont(await response.arrayBuffer())
  } catch (error) {
    setFontFailed(true)
    console.error('Could not load the letter font; Text shapes will show a warning.', error)
  }
}

void loadLetters()

const apiReady = initBrowserOC().then(() => createGeometryApi(new Evaluator(registry, createCadToolkit())))

const api: GeometryApi = {
  rebuild: async (doc) => (await apiReady).rebuild(doc),
  exportStl: async (doc, ids) => (await apiReady).exportStl(doc, ids),
  export3mf: async (doc, ids) => (await apiReady).export3mf(doc, ids),
  exportStep: async (doc, ids) => (await apiReady).exportStep(doc, ids),
  edgeCandidates: async (doc, nodeId, modifierId) => (await apiReady).edgeCandidates(doc, nodeId, modifierId),
  overlap: async (doc, a, b) => (await apiReady).overlap(doc, a, b),
}

Comlink.expose(api)
