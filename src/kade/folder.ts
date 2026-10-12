import type { ShapePlugin } from '../plugins/types'
import { readShapeDefinition } from './definition'
import { metaToPlugin } from './meta'
import { isRecord } from './settings'

const fileName = (path: string): string => path.split('/').pop() ?? path

function idFromPath(path: string): string {
  const id = fileName(path).replace(/\.(js|ts)$/, '').toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-').replace(/^[^a-z]+/, '').replace(/-+$/, '')
  return id || 'plugin'
}

const versionOf = (raw: unknown): number => (typeof raw === 'number' && Number.isInteger(raw) && raw >= 1 ? raw : 1)

type Loaded = { readonly plugin: ShapePlugin } | { readonly problem: string }

function loadOne(path: string, value: unknown): Loaded {
  const definition = readShapeDefinition({ default: value })
  if (!definition.ok) return { problem: `Plugin file "${fileName(path)}" has a problem: ${definition.error}` }
  const raw = isRecord(value) ? value : {}
  const id = typeof raw.id === 'string' ? raw.id : idFromPath(path)
  const plugin: ShapePlugin = {
    ...metaToPlugin(id, definition.value.meta),
    version: versionOf(raw.version),
    // Folder plugins take the friendly toolkit; the evaluator calls them through runKadeBuild.
    build: definition.value.build as unknown as ShapePlugin['build'],
  }
  return { plugin }
}

/** Plugin files in the plugins/ folder, checked the same friendly way as Kade's library shapes. */
export function loadFolderPlugins(modules: Readonly<Record<string, unknown>>): { plugins: ShapePlugin[]; problems: string[] } {
  const loaded = Object.entries(modules).map(([path, value]) => loadOne(path, value))
  return {
    plugins: loaded.flatMap((l) => ('plugin' in l ? [l.plugin] : [])),
    problems: loaded.flatMap((l) => ('problem' in l ? [l.problem] : [])),
  }
}
