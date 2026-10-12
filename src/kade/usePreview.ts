import { useEffect, useState, useSyncExternalStore } from 'react'
import type { GeometryClient } from '../geometry/client'
import type { BloKadeStore } from '../store/store'
import type { CodeView, CodeViewSource } from './code-view'
import type { EditorStore } from './editor-store'
import { createPreviewStatus, createPreviewStore, followSelectedShape, syncPreview, type PreviewStatusStore } from './preview'

/** The preview's own design store, following the editor's selected shape and rebuilding on the 'preview' channel. */
export function usePreview(editor: EditorStore, client: GeometryClient): { store: BloKadeStore; status: PreviewStatusStore } {
  const [store] = useState(createPreviewStore)
  const [status] = useState(createPreviewStatus)
  useEffect(() => syncPreview(store, client, status), [store, client, status])
  useEffect(() => followSelectedShape(editor, store), [editor, store])
  return { store, status }
}

export function useCodeView(source: CodeViewSource): CodeView {
  return useSyncExternalStore(source.subscribe, source.read)
}
