import { addModifier, MODIFIER_LABELS, MODIFIER_TYPES, modifiersOf, moveModifier, removeModifier, setModifierEnabled } from '../document/modifiers'
import type { FieldKey, ModifierType, SceneNode } from '../document/types'
import { useBloKade } from '../store/context'
import { ModifierCard } from './ModifierCard'
import { MODIFIER_ICONS } from './modifier-icons'

interface ModifierStackProps {
  node: SceneNode
  errors: Readonly<Record<string, string>>
  setField(key: FieldKey, text: string): void
}

/** Round edges, repeat and mirror for one part, applied top to bottom. */
export function ModifierStack({ node, errors, setField }: ModifierStackProps) {
  const apply = useBloKade((s) => s.apply)
  const warnings = useBloKade((s) => (Object.hasOwn(s.modifierWarnings, node.id) ? s.modifierWarnings[node.id] : undefined))
  const modifiers = modifiersOf(node)
  const add = (type: ModifierType): void => apply((d) => addModifier(d, node.id, type).doc)
  return (
    <div className="modifier-stack">
      <h3>Modifiers</h3>
      {modifiers.length === 0 && <p className="hint">Round its edges, repeat it, or mirror it.</p>}
      <ol className="modifier-list">
        {modifiers.map((m, index) => (
          <ModifierCard key={m.id} node={node} modifier={m} index={index} last={index === modifiers.length - 1}
            warning={warnings && Object.hasOwn(warnings, m.id) ? warnings[m.id] : undefined}
            errors={errors} setField={setField}
            onEnabled={(enabled) => apply((d) => setModifierEnabled(d, node.id, m.id, enabled))}
            onMove={(delta) => apply((d) => moveModifier(d, node.id, m.id, delta))}
            onRemove={() => apply((d) => removeModifier(d, node.id, m.id))} />
        ))}
      </ol>
      <select className="add-modifier" data-testid="add-modifier" aria-label="Add a modifier" value=""
        onChange={(e) => { if (e.target.value) add(e.target.value as ModifierType) }}>
        <option value="">+ Add a modifier…</option>
        {MODIFIER_TYPES.map((t) => <option key={t} value={t}>{MODIFIER_ICONS[t]} {MODIFIER_LABELS[t]}</option>)}
      </select>
    </div>
  )
}
