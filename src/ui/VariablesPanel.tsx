import { useMemo } from 'react'
import { createFieldNormalizer } from '../app/field-normalizer'
import { variableValues } from '../document/formula-ops'
import { addVariable, nextVariableName, removeVariable, renameVariable, setFit, setVariableExpr } from '../document/variable-ops'
import type { PluginRegistry } from '../plugins/registry'
import { useBloKade } from '../store/context'
import { NumberField, TextField } from './NumberField'
import { ValueField } from './ValueField'

/** Design-wide numbers: the `fit` gap and Kade's named variables. */
export function VariablesPanel({ registry }: { registry: PluginRegistry }) {
  const doc = useBloKade((s) => s.history.present)
  const apply = useBloKade((s) => s.apply)
  const normalize = useMemo(() => createFieldNormalizer(registry), [registry])
  const { scope, errors } = useMemo(() => variableValues(doc), [doc])

  return (
    <section className="panel" aria-label="Variables">
      <h2 data-help="panel-variables">Variables</h2>
      <NumberField label="Fit gap (mm)" value={doc.settings.fit} testId="fit" onCommit={(fit) => apply((d) => setFit(d, fit, normalize))} />
      <p className="hint">Extra room for parts that slot together. Formulas can use it as <code>fit</code>.</p>
      <ul className="variable-list">
        {doc.variables.map((v) => (
          <li key={v.name} className="variable-row">
            <TextField label="Name" value={v.name} testId={`var-name-${v.name}`}
              onCommit={(name) => apply((d) => renameVariable(d, v.name, name, normalize))} />
            <ValueField label="=" value={scope.get(v.name) ?? 0} formula={v.expr}
              error={Object.hasOwn(errors, v.name) ? errors[v.name] : undefined} testId={`var-expr-${v.name}`}
              onCommit={(expr) => apply((d) => setVariableExpr(d, v.name, expr, normalize))} />
            <button type="button" className="icon-button" data-testid={`var-delete-${v.name}`} aria-label={`Delete ${v.name}`}
              onClick={() => apply((d) => removeVariable(d, v.name, normalize))}>🗑</button>
          </li>
        ))}
      </ul>
      <button type="button" className="tool-button" data-testid="add-variable"
        onClick={() => apply((d) => addVariable(d, nextVariableName(d), '10', normalize))}>+ Add variable</button>
    </section>
  )
}
