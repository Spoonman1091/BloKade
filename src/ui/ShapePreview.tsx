import { useMemo } from 'react'
import { createFieldNormalizer } from '../app/field-normalizer'
import { formulaErrors, setFieldInput } from '../document/formula-ops'
import { updateNode } from '../document/ops'
import type { BloKadeDocument, FieldKey, NodeId } from '../document/types'
import { resolveParams } from '../plugins/params'
import { PREVIEW_ID } from '../kade/preview'
import type { PluginRegistry } from '../plugins/registry'
import { StoreProvider, useBloKade } from '../store/context'
import type { BloKadeStore } from '../store/store'
import { Viewport } from '../viewport/Viewport'
import { ShapeSettings } from './PropertiesPanel'

/** The preview starts with no saved settings, so fill in the defaults before a field is typed into. */
function withDefaultParams(doc: BloKadeDocument, id: NodeId, registry: PluginRegistry): BloKadeDocument {
  return updateNode(doc, id, (n) => {
    const plugin = n.kind === 'shape' ? registry.get(n.shapeType) : undefined
    return n.kind === 'shape' && plugin ? { ...n, params: resolveParams(plugin, n.params) } : n
  })
}

function PreviewSettings({ registry }: { registry: PluginRegistry }) {
  const doc = useBloKade((s) => s.history.present)
  const apply = useBloKade((s) => s.apply)
  const normalize = useMemo(() => createFieldNormalizer(registry), [registry])
  const errors = useMemo(() => formulaErrors(doc), [doc])
  const node = Object.hasOwn(doc.nodes, PREVIEW_ID) ? doc.nodes[PREVIEW_ID] : undefined
  if (node?.kind !== 'shape') return null
  const setField = (key: FieldKey, text: string): void => apply((d) => setFieldInput(withDefaultParams(d, PREVIEW_ID, registry), PREVIEW_ID, key, text, normalize))
  return <ShapeSettings key={node.shapeType} node={node} errors={errors[PREVIEW_ID] ?? {}} setField={setField} registry={registry} />
}

interface ShapePreviewProps {
  /** The preview's own one-part design. */
  store: BloKadeStore
  registry: PluginRegistry
  canAdd: boolean
  onAdd(): void
}

/** The right side of My shapes: the shape in 3D, its settings to try, and ➕ Add to my design. */
export function ShapePreview({ store, registry, canAdd, onAdd }: ShapePreviewProps) {
  return (
    <StoreProvider store={store}>
      <section className="panel shape-preview" aria-label="Preview">
        <h2 data-help="panel-preview">Preview</h2>
        <div className="preview-view" data-testid="preview-view">
          <Viewport registry={registry} onToggleEdge={() => undefined} />
        </div>
        <PreviewSettings registry={registry} />
        <button type="button" className="tool-button primary add-to-design" data-testid="add-to-design" disabled={!canAdd} onClick={onAdd}>
          ➕ Add to my design
        </button>
      </section>
    </StoreProvider>
  )
}
