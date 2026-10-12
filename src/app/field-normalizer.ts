import type { NormalizeField } from '../document/formula-ops'
import { MAX_MM, normalizeParam } from '../plugins/params'
import type { PluginRegistry } from '../plugins/registry'

const clamp = (value: number, low: number, high: number): number => Math.min(high, Math.max(low, value))

/** Clamps numbers the same way whether Kade typed them or a formula worked them out. */
export function createFieldNormalizer(registry: PluginRegistry): NormalizeField {
  return (node, key, value) => {
    if (key.startsWith('position.')) return clamp(value, -MAX_MM, MAX_MM)
    if (!key.startsWith('param.') || node.kind !== 'shape') return value
    const name = key.slice('param.'.length)
    const plugin = registry.get(node.shapeType)
    const spec = plugin && Object.hasOwn(plugin.params, name) ? plugin.params[name] : undefined
    return spec && spec.type !== 'text' ? normalizeParam(spec, value) : value
  }
}
