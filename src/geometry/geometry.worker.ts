import * as Comlink from 'comlink'
import fontUrl from '../assets/fonts/AtkinsonHyperlegible-Bold.ttf?url'
import { createCadToolkit } from '../plugins/cad'
import { registerFont, setFontFailed } from '../plugins/font'
import { registry } from '../plugins/index'
import { blobModuleLoader } from '../kade/blob-loader'
import { KadeShapes } from '../kade/kade-shapes'
import { createGeometryApi } from './api'
import { Evaluator } from './evaluate'
import { initBrowserOC } from './oc-browser'
import { shapeRunMessage } from './shape-runs'
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

/** Tells the page which of Kade's code is running, so a stuck worker's shape can be skipped after the restart. */
const reportRun = (hash: string, running: boolean): void => {
  (globalThis as unknown as { postMessage(message: unknown): void }).postMessage(shapeRunMessage(hash, running))
}

const apiReady = initBrowserOC().then(() =>
  createGeometryApi(new Evaluator(registry, createCadToolkit()), new KadeShapes(blobModuleLoader, registry, reportRun)))

const api: GeometryApi = {
  rebuild: async (doc, channel) => (await apiReady).rebuild(doc, channel),
  prepareStl: async (bytes) => (await apiReady).prepareStl(bytes),
  exportStl: async (doc, ids) => (await apiReady).exportStl(doc, ids),
  export3mf: async (doc, ids) => (await apiReady).export3mf(doc, ids),
  exportStep: async (doc, ids) => (await apiReady).exportStep(doc, ids),
  edgeCandidates: async (doc, nodeId, modifierId) => (await apiReady).edgeCandidates(doc, nodeId, modifierId),
  overlap: async (doc, a, b) => (await apiReady).overlap(doc, a, b),
  inspect: async (code) => (await apiReady).inspect(code),
  skipShapes: async (hashes) => (await apiReady).skipShapes(hashes),
}

Comlink.expose(api)
