import { MAX_SHAPE_CODE_LENGTH, type BloKadeDocument, type CarriedShape } from '../document/types'
import type { PluginRegistry } from '../plugins/registry'
import type { ShapePlugin } from '../plugins/types'
import { fail, type Result } from '../shared/result'
import { DEFAULT_ICON, readShapeDefinition, type ShapeDefinition } from './definition'
import { friendlyError } from './errors'
import { codeHash } from './hash'
import { CHECK_FAILED, CODE_TOO_BIG } from './messages'
import { metaToPlugin, type InspectResult } from './meta'
import { ModuleLoadError, type LoadedModule, type ModuleLoader } from './module-loader'
import type { KadeBuild } from './run-build'
import { findSyntaxProblem } from './syntax'

interface Checked {
  readonly result: InspectResult
  readonly build?: KadeBuild
  readonly source?: string
  dispose(): void
}

const failed = (problem: string): Checked => ({ result: { ok: false, problem }, dispose: () => undefined })

/** Worker side of Kade's shapes: loads and checks code (cached by hash) and makes each design's shape list. */
export class KadeShapes {
  /** Oldest first, so the first key is the one to forget. */
  private readonly checked = new Map<string, Promise<Checked>>()

  constructor(private readonly load: ModuleLoader, private readonly base: PluginRegistry, private readonly limit = 50) {}

  async inspect(code: string): Promise<InspectResult> {
    return (await this.entry(code)).result
  }

  /** The built-in shapes plus every shape the design carries. Built-in ids always win. */
  async registryFor(doc: BloKadeDocument): Promise<PluginRegistry> {
    const carried = Object.entries(doc.plugins).filter(([id]) => !this.base.get(id))
    if (carried.length === 0) return this.base
    const entries = await Promise.all(carried.map(async ([id, shape]) => [id, this.pluginFor(id, shape, await this.entry(shape.code))] as const))
    const byId = new Map(entries)
    const list = [...this.base.list(), ...byId.values()]
    return { get: (id) => this.base.get(id) ?? byId.get(id), list: () => list }
  }

  private pluginFor(id: string, shape: CarriedShape, checked: Checked): ShapePlugin {
    const revision = codeHash(shape.code)
    if (!checked.result.ok || !checked.build) {
      const problem = checked.result.ok ? CHECK_FAILED : checked.result.problem
      return { id, name: shape.name, icon: DEFAULT_ICON, version: 1, revision, toolkit: 'kade', params: {}, build: () => { throw new Error(problem) } }
    }
    // Kade's builds take the friendly toolkit; the evaluator calls them through runKadeBuild.
    return { ...metaToPlugin(id, checked.result.meta, revision), source: checked.source, build: checked.build as unknown as ShapePlugin['build'] }
  }

  private entry(code: string): Promise<Checked> {
    const key = codeHash(code)
    const hit = this.checked.get(key)
    if (hit) {
      this.checked.delete(key)
      this.checked.set(key, hit)
      return hit
    }
    const made = this.safeCheck(code)
    this.checked.set(key, made)
    this.forgetOldest()
    return made
  }

  private forgetOldest(): void {
    while (this.checked.size > this.limit) {
      const oldest = this.checked.keys().next().value
      if (oldest === undefined) return
      const entry = this.checked.get(oldest)
      this.checked.delete(oldest)
      // Shapes already built from it keep working; only the blob URL is let go.
      void entry?.then((c) => c.dispose())
    }
  }

  /** Never rejects: anything unexpected becomes CHECK_FAILED, so one bad shape can't break a worker call. */
  private async safeCheck(code: string): Promise<Checked> {
    try {
      return await this.check(code)
    } catch (error) {
      console.error("Could not check one of Kade's shapes", error)
      return failed(CHECK_FAILED)
    }
  }

  private async check(code: string): Promise<Checked> {
    if (code.length > MAX_SHAPE_CODE_LENGTH) return failed(CODE_TOO_BIG)
    const syntax = findSyntaxProblem(code)
    if (syntax) return failed(syntax)
    const loaded = await this.loadModule(code)
    if ('problem' in loaded) return failed(loaded.problem)
    const definition = readDefinition(loaded)
    if (!definition.ok) {
      loaded.dispose()
      return failed(definition.error)
    }
    return { result: { ok: true, meta: definition.value.meta }, build: definition.value.build, source: loaded.source, dispose: loaded.dispose }
  }

  private async loadModule(code: string): Promise<LoadedModule | { readonly problem: string }> {
    try {
      return await this.load(code)
    } catch (error) {
      if (error instanceof ModuleLoadError) return { problem: friendlyError(error.original, error.source) }
      console.error("Could not load one of Kade's shapes", error)
      return { problem: CHECK_FAILED }
    }
  }
}

/** Reads the definition. Kade's code can throw while it is read (a getter, say), so that becomes a friendly problem. */
function readDefinition(loaded: LoadedModule): Result<ShapeDefinition> {
  try {
    return readShapeDefinition(loaded.exports)
  } catch (error) {
    return fail(friendlyError(error, loaded.source))
  }
}
