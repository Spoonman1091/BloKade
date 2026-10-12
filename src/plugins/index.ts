import { createRegistry } from './registry'

const builtin = import.meta.glob<unknown>('./builtin/*.ts', { eager: true, import: 'default' })
const kades = import.meta.glob<unknown>('../../plugins/**/*.{js,ts}', { eager: true, import: 'default' })

const BUILTIN_ORDER = ['box', 'cylinder', 'sphere', 'cone', 'wedge', 'torus']
const orderOf = (path: string): number => {
  const index = BUILTIN_ORDER.findIndex((name) => path.endsWith(`/${name}.ts`))
  return index === -1 ? BUILTIN_ORDER.length : index
}

const builtinPlugins = Object.entries(builtin)
  .sort(([a], [b]) => orderOf(a) - orderOf(b))
  .map(([, plugin]) => plugin)

export const { registry, problems: pluginProblems } = createRegistry([...builtinPlugins, ...Object.values(kades)])
