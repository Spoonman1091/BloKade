import { MODIFIER_LABELS } from '../document/modifiers'
import { ModifierFields, type ModifierFieldsProps } from './ModifierFields'
import { MODIFIER_ICONS } from './modifier-icons'

interface ModifierCardProps extends ModifierFieldsProps {
  last: boolean
  warning?: string
  onEnabled(enabled: boolean): void
  onMove(delta: -1 | 1): void
  onRemove(): void
}

export function ModifierCard(props: ModifierCardProps) {
  const { modifier: m, index, last, warning } = props
  const label = MODIFIER_LABELS[m.type]
  return (
    <li className="modifier-card" data-testid={`modifier-${index}`}>
      <div className="modifier-head">
        <label className="modifier-title">
          <input type="checkbox" data-testid={`mod-enabled-${index}`} checked={m.enabled} aria-label={`Use ${label}`}
            onChange={(e) => props.onEnabled(e.target.checked)} />
          <span aria-hidden="true">{MODIFIER_ICONS[m.type]}</span> {label}
        </label>
        <button type="button" className="icon-button" data-testid={`mod-up-${index}`} aria-label={`Move ${label} up`}
          disabled={index === 0} onClick={() => props.onMove(-1)}>↑</button>
        <button type="button" className="icon-button" data-testid={`mod-down-${index}`} aria-label={`Move ${label} down`}
          disabled={last} onClick={() => props.onMove(1)}>↓</button>
        <button type="button" className="icon-button" data-testid={`mod-delete-${index}`} aria-label={`Delete ${label}`}
          onClick={props.onRemove}>🗑</button>
      </div>
      {warning && <p className="field-error" data-testid={`mod-warning-${index}`}>⚠ {warning}</p>}
      {m.enabled && <ModifierFields {...props} />}
    </li>
  )
}
