import Module, { type ManifoldToplevel } from 'manifold-3d'
import wasmUrl from 'manifold-3d/manifold.wasm?url'

let cached: Promise<ManifoldToplevel> | undefined

const inNode = (): boolean => typeof process !== 'undefined' && Boolean(process.versions?.node)

async function load(): Promise<ManifoldToplevel> {
  // Node (Vitest) finds the .wasm beside the package; a browser worker needs the bundled URL.
  const wasm = await (inNode() ? Module() : Module({ locateFile: () => wasmUrl }))
  wasm.setup()
  return wasm
}

/** The Manifold WebAssembly module, loaded once. Works in a module worker and under Vitest. */
export function loadManifold(): Promise<ManifoldToplevel> {
  if (!cached) {
    cached = load().catch((error: unknown) => {
      cached = undefined
      throw error
    })
  }
  return cached
}
