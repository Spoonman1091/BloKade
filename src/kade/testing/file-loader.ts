import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { ModuleLoadError, type ModuleLoader } from '../module-loader'

const folder = mkdtempSync(join(tmpdir(), 'blokade-shapes-'))
let count = 0

/** Node tests load Kade's code from a temp .mjs file (the worker uses a blob URL). Stacks name the file path. */
export const fileModuleLoader: ModuleLoader = async (code) => {
  count += 1
  const file = join(folder, `shape-${count}.mjs`)
  writeFileSync(file, code)
  const dispose = (): void => rmSync(file, { force: true })
  try {
    const exports = (await import(/* @vite-ignore */ pathToFileURL(file).href)) as Record<string, unknown>
    return { exports, source: file, dispose }
  } catch (error) {
    dispose()
    throw new ModuleLoadError(error, file)
  }
}
