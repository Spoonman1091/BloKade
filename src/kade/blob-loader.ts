import { ModuleLoadError, type ModuleLoader } from './module-loader'

/**
 * Loads Kade's code in the geometry worker from a blob URL. This is the one sanctioned way BloKade runs
 * Kade's code: never on the page, and never with eval or new Function.
 * The blob holds Kade's code exactly, with nothing added, so error line numbers match the code box.
 */
export const blobModuleLoader: ModuleLoader = async (code) => {
  const source = URL.createObjectURL(new Blob([code], { type: 'text/javascript' }))
  try {
    const exports = (await import(/* @vite-ignore */ source)) as Record<string, unknown>
    return { exports, source, dispose: () => URL.revokeObjectURL(source) }
  } catch (error) {
    URL.revokeObjectURL(source)
    throw new ModuleLoadError(error, source)
  }
}
