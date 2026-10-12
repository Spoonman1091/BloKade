import { setOC } from 'replicad'
import opencascade from 'replicad-opencascadejs'
import wasmUrl from 'replicad-opencascadejs/wasm?url'

let ready: Promise<void> | null = null

/** Loads OpenCascade (about 10–20 MB of WASM) once per worker. */
export function initBrowserOC(): Promise<void> {
  ready ??= opencascade({ locateFile: () => wasmUrl }).then((oc) => setOC(oc))
  return ready
}
