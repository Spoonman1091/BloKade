import { describe, expect, it } from 'vitest'
import { friendlyError } from './errors'
import { ModuleLoadError } from './module-loader'
import { fileModuleLoader } from './testing/file-loader'

describe('fileModuleLoader', () => {
  it('loads a module and hands back its exports', async () => {
    const loaded = await fileModuleLoader("export default { name: 'A' }\nexport const extra = 2")
    expect(loaded.exports.default).toEqual({ name: 'A' })
    expect(loaded.exports.extra).toBe(2)
    loaded.dispose()
  })
  it('reports top-level errors with the source, so the line can be found', async () => {
    const error = await fileModuleLoader("const a = 1\nconst b = nope + 1\nexport default {}").catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ModuleLoadError)
    const loadError = error as ModuleLoadError
    expect(friendlyError(loadError.original, loadError.source)).toBe('Line 2: there\'s nothing called "nope" — check the spelling.')
  })
})
