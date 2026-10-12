import { formulaOf, paramField } from '../document/fields'
import type { FieldKey, ParamValue, ShapeNode } from '../document/types'
import { normalizeChoiceParam } from '../plugins/params'
import type { NumberParamType, ParamSpec } from '../plugins/types'
import { TextField } from './NumberField'
import { ValueField } from './ValueField'

const UNIT: Record<NumberParamType, string> = { mm: ' (mm)', angle: ' (°)', whole: '', number: '' }

interface ParamFieldProps {
  node: ShapeNode
  name: string
  spec: ParamSpec
  errors: Readonly<Record<string, string>>
  setField(key: FieldKey, text: string): void
  /** Saves a text or choice parameter as-is. */
  setRaw(name: string, value: ParamValue): void
}

/** The right control for one shape parameter: a number/formula box, a line of text, or a list of options. */
export function ParamField({ node, name, spec, errors, setField, setRaw }: ParamFieldProps) {
  const raw = node.params[name]
  if (spec.type === 'text') {
    return <TextField label={spec.label} value={typeof raw === 'string' ? raw : spec.default} testId={`param-${name}`}
      onCommit={(text) => setRaw(name, text)} />
  }
  if (spec.type === 'yesno') {
    return (
      <label className="checkbox-field">
        <input type="checkbox" data-testid={`param-${name}`} checked={typeof raw === 'boolean' ? raw : spec.default}
          onChange={(e) => setRaw(name, e.target.checked)} />
        <span>{spec.label}</span>
      </label>
    )
  }
  if (spec.type === 'choice') {
    return (
      <label className="field">
        <span>{spec.label}</span>
        <select data-testid={`param-${name}`} value={normalizeChoiceParam(spec, raw)}
          onChange={(e) => setRaw(name, e.target.value)}>
          {spec.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </label>
    )
  }
  const field = paramField(name)
  return <ValueField label={`${spec.label}${UNIT[spec.type]}`} value={typeof raw === 'number' ? raw : spec.default}
    formula={formulaOf(node, field)} error={errors[field]} testId={`param-${name}`} onCommit={(text) => setField(field, text)} />
}
