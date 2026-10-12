import { useEffect, useMemo, useState } from 'react'
import { useStore } from 'zustand'
import type { GeometryClient } from '../geometry/client'
import type { ShapeCatalog } from '../kade/catalog'
import { createCodeViewSource, type CodeView } from '../kade/code-view'
import { currentCode, selectedShape, type EditorStore } from '../kade/editor-store'
import { GEAR_CODE } from '../kade/examples/gear'
import { CODE_LESSONS } from '../kade/lessons'
import { watchCodeSteps } from '../kade/lessons/watch-code-steps'
import type { LibraryShape } from '../kade/library'
import { useCodeView, usePreview } from '../kade/usePreview'
import { useShapeRegistry } from '../kade/useShapeRegistry'
import type { LessonStore } from '../learn/lesson-store'
import type { PluginRegistry } from '../plugins/registry'
import { CodeBox, type CodeJump } from './CodeBox'
import { CodeLessonsPanel } from './CodeLessonsPanel'
import { CommandsReference } from './CommandsReference'
import { LibraryList } from './LibraryList'
import { ProblemList } from './ProblemList'
import { ShapePreview } from './ShapePreview'

const NO_SHAPES: readonly LibraryShape[] = []

export interface MyShapesScreenProps {
  editor: EditorStore
  lessons: LessonStore
  catalog: ShapeCatalog
  /** Built-in shapes and plugins/ folder files. */
  base: PluginRegistry
  client: GeometryClient
  helpMode: boolean
  onHelpMode(): void
  onBack(): void
  onAdd(shapeId: string): void
}

function EditorHeader({ helpMode, onHelpMode, onBack }: Pick<MyShapesScreenProps, 'helpMode' | 'onHelpMode' | 'onBack'>) {
  return (
    <header className="toolbar">
      <span className="brand">BloKade</span>
      <button type="button" className="tool-button" data-testid="back-to-design" onClick={onBack}>⬅ Back to my design</button>
      <h1 className="editor-title">🧩 My shapes</h1>
      <button type="button" className="tool-button" data-testid="help-mode" data-help-toggle="" aria-pressed={helpMode}
        aria-label="Help mode" onClick={onHelpMode}>❓</button>
    </header>
  )
}

function EditorSidebar({ editor, lessons, view }: { editor: EditorStore; lessons: LessonStore; view: CodeView }) {
  const tab = useStore(editor, (s) => s.tab)
  const { setTab, create } = editor.getState()
  return (
    <aside className="left-panel">
      <LibraryList editor={editor} />
      <div className="editor-tabs" role="tablist" aria-label="Lessons and commands">
        <button type="button" role="tab" className="tool-button" data-testid="tab-lessons" aria-selected={tab === 'lessons'}
          onClick={() => setTab('lessons')}>📘 Lessons</button>
        <button type="button" role="tab" className="tool-button" data-testid="tab-commands" aria-selected={tab === 'commands'}
          onClick={() => setTab('commands')}>❓ Commands</button>
      </div>
      {tab === 'lessons'
        ? <div className="panel"><CodeLessonsPanel lessons={lessons} editor={editor} view={view} codeLessons={CODE_LESSONS} /></div>
        : <CommandsReference onUseGear={() => create(GEAR_CODE)} />}
    </aside>
  )
}

function CodePane({ editor, view }: { editor: EditorStore; view: CodeView }) {
  const shape = useStore(editor, (s) => selectedShape(s))
  const notice = useStore(editor, (s) => s.notice)
  const [jump, setJump] = useState<CodeJump | null>(null)
  const onJump = (line: number): void => setJump((last) => ({ line, nonce: (last?.nonce ?? 0) + 1 }))
  return (
    <main className="code-pane" aria-label="Code">
      <h2 className="code-heading" data-help="panel-code">{shape ? shape.name : 'Code'}</h2>
      {notice && (
        <p className="editor-notice" role="alert">
          {notice}
          <button type="button" className="icon-button" data-help="toast-dismiss" aria-label="Dismiss message"
            onClick={() => editor.getState().notify(null)}>✕</button>
        </p>
      )}
      {shape ? (
        <>
          <CodeBox docKey={shape.id} code={currentCode(editor.getState(), shape.id) ?? shape.code}
            onChange={(code) => editor.getState().setCode(shape.id, code)} jump={jump} />
          <ProblemList view={view} onJump={onJump} />
        </>
      ) : (
        <p className="hint">Press <strong>+ New shape</strong> to start, or try a lesson on the left.</p>
      )}
    </main>
  )
}

/** 🧩 My shapes: Kade's library and lessons on the left, the code in the middle, the live preview on the right. */
export function MyShapesScreen({ editor, lessons, catalog, base, client, helpMode, onHelpMode, onBack, onAdd }: MyShapesScreenProps) {
  const preview = usePreview(editor, client)
  const source = useMemo(
    () => createCodeViewSource({ editor, catalog, preview: preview.store, status: preview.status }),
    [editor, catalog, preview.store, preview.status],
  )
  const view = useCodeView(source)
  useEffect(() => watchCodeSteps(lessons, source, CODE_LESSONS), [lessons, source])
  const carried = useStore(preview.store, (s) => s.history.present.plugins)
  const registry = useShapeRegistry({ base, catalog, library: NO_SHAPES, carried })
  const shapeId = view.shapeId
  const canAdd = shapeId !== null && !view.typing && view.built && registry.get(shapeId) !== undefined
  return (
    <div className="workspace my-shapes">
      <EditorHeader helpMode={helpMode} onHelpMode={onHelpMode} onBack={onBack} />
      <EditorSidebar editor={editor} lessons={lessons} view={view} />
      <CodePane editor={editor} view={view} />
      <aside className="right-panel">
        {shapeId && <ShapePreview store={preview.store} registry={registry} canAdd={canAdd} onAdd={() => onAdd(shapeId)} />}
      </aside>
    </div>
  )
}
