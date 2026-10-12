// src/kade/module-loader.ts
export interface LoadedModule {
  readonly exports: Readonly<Record<string, unknown>>
  /** Where the code was loaded from. Error stacks name it, which is how errors get line numbers. */
  readonly source: string
  /** Lets go of the loaded file or blob URL. The module's functions keep working. */
  dispose(): void
}

/** Loads Kade's code as a JavaScript module. Only the geometry worker (and Node tests) may do this. */
export type ModuleLoader = (code: string) => Promise<LoadedModule>

/** The code failed while it was loading, for example a misspelt name at the top of the file. */
export class ModuleLoadError extends Error {
  override name = 'ModuleLoadError'
  constructor(readonly original: unknown, readonly source: string) {
    super(original instanceof Error ? original.message : String(original))
  }
}
