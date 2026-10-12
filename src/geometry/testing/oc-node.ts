import { createRequire } from 'node:module'
import { setOC } from 'replicad'
import opencascade from 'replicad-opencascadejs'

let ready: Promise<void> | null = null

/** Loads OpenCascade into replicad for Node-based tests (once per test worker). */
export function initTestOC(): Promise<void> {
  if (!ready) {
    const wasmPath = createRequire(import.meta.url).resolve('replicad-opencascadejs/wasm')
    ready = opencascade({ locateFile: () => wasmPath }).then((oc) => setOC(oc))
  }
  return ready
}
