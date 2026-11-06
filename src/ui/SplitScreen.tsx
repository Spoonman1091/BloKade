import { useEffect, useState } from 'react'
import { createSplitClient, type SplitClient } from '../split/split-client'
import { PieceMap } from './split/PieceMap'
import { SplitSettings } from './split/SplitSettings'
import { SplitView } from './split/SplitView'
import { useSplit } from './split/useSplit'
import { PrinterPicker } from './Toolbar'

export interface SplitScreenProps {
  /** Makes the client (and so the worker) when the screen opens. Tests give a fake. */
  createClient?(): SplitClient
  helpMode: boolean
  onHelpMode(): void
  onBack(): void
}

function SplitHeader({ helpMode, onHelpMode, onBack }: Pick<SplitScreenProps, 'helpMode' | 'onHelpMode' | 'onBack'>) {
  return (
    <header className="toolbar">
      <span className="brand">BloKade</span>
      <button type="button" className="tool-button" data-testid="split-back" onClick={onBack}>⬅ Back to my design</button>
      <h1 className="editor-title">✂ Split for printing</h1>
      <PrinterPicker />
      <button type="button" className="tool-button" data-testid="help-mode" data-help-toggle="" aria-pressed={helpMode}
        aria-label="Help mode" onClick={onHelpMode}>❓</button>
    </header>
  )
}

function SplitBody({ client, onBack, helpMode, onHelpMode }: SplitScreenProps & { client: SplitClient }) {
  const split = useSplit(client)
  return (
    <div className="workspace split-screen">
      <SplitHeader helpMode={helpMode} onHelpMode={onHelpMode} onBack={onBack} />
      <main className="viewport split-view" data-testid="split-view">
        <SplitView info={split.info} grid={split.grid} result={split.pieces} />
        {split.info && split.grid && split.pieces && (
          <div className="split-map-box"><PieceMap size={split.info.size} grid={split.grid} result={split.pieces} /></div>
        )}
        {!split.info && <p className="viewport-hint" role="status">Open an STL file to start.</p>}
      </main>
      <SplitSettings split={split} />
    </div>
  )
}

/** ✂ Split for printing: open a model that is too big, cut it into pieces that fit the printer, save them as a ZIP. */
export function SplitScreen({ createClient = createSplitClient, ...rest }: SplitScreenProps) {
  const [client, setClient] = useState<SplitClient | null>(null)
  const [make] = useState(() => createClient)
  // The worker (and Manifold) exist only while this screen is open.
  useEffect(() => {
    const made = make()
    setClient(made)
    return () => { made.dispose(); setClient(null) }
  }, [make])
  return client ? <SplitBody client={client} {...rest} /> : null
}
