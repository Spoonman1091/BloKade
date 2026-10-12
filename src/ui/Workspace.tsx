import { useCallback, useMemo, useState } from 'react'
import { useStore } from 'zustand'
import { checkOverlap } from '../app/check-overlap'
import { createActions, type Actions } from '../app/actions'
import type { AppDeps } from '../app/deps'
import type { DesignSession } from '../app/design-session'
import { exportDesign, type ExportFormat } from '../app/export'
import { useShortcuts } from '../app/shortcuts'
import { useAutosave } from '../app/useAutosave'
import { useEdgeCandidates } from '../app/useEdgeCandidates'
import { useGeometrySync } from '../app/useGeometrySync'
import { useShapeSetup, type ShapeSetup } from '../app/useShapeSetup'
import type { EditorStore } from '../kade/editor-store'
import { ALL_LESSONS } from '../learn/all-lessons'
import { createLessonStore, currentStepOf, type LessonStore } from '../learn/lesson-store'
import { browserStorage } from '../learn/progress'
import { startLesson } from '../learn/start-lesson'
import { TUTORIALS } from '../learn/tutorials'
import { useStepWatcher } from '../learn/watch-steps'
import { KITS } from '../plugins/kits'
import { useBloKadeStore } from '../store/context'
import type { BloKadeStore } from '../store/store'
import { Viewport } from '../viewport/Viewport'
import { DesignsDialog } from './DesignsDialog'
import { EmptyNudge } from './EmptyNudge'
import { HelpMode } from './HelpMode'
import { HelpTooltips } from './HelpTooltips'
import { LessonsPanel } from './LessonsPanel'
import { MyShapesScreen } from './MyShapesScreen'
import { NewerShapesBanner } from './NewerShapesBanner'
import { PropertiesPanel } from './PropertiesPanel'
import { SceneTree } from './SceneTree'
import { ShapePalette } from './ShapePalette'
import { Toasts } from './Toasts'
import { Toolbar } from './Toolbar'
import { VariablesPanel } from './VariablesPanel'

function useLessonTarget(store: BloKadeStore, lessons: LessonStore): string | null {
  const openDesignId = useStore(store, (s) => s.designId)
  return useStore(lessons, (s) => {
    const active = s.progress.active
    if (!s.panelOpen || !active || active.designId !== openDesignId) return null
    return currentStepOf(s.progress, TUTORIALS)?.target ?? null
  })
}

interface HelpControls {
  readonly helpMode: boolean
  toggle(): void
  exit(): void
  learnMore(tutorialId: string): void
}

function useHelpControls(lessons: LessonStore): HelpControls {
  const [helpMode, setHelpMode] = useState(false)
  const toggle = useCallback(() => setHelpMode((on) => !on), [])
  const exit = useCallback(() => setHelpMode(false), [])
  const learnMore = useCallback((tutorialId: string) => {
    setHelpMode(false)
    lessons.getState().openPanel(tutorialId)
  }, [lessons])
  return { helpMode, toggle, exit, learnMore }
}

/** Notices, tooltips and help mode, on both screens. */
function HelpLayers({ store, lessons, help }: { store: BloKadeStore; lessons: LessonStore; help: HelpControls }) {
  const lessonTarget = useLessonTarget(store, lessons)
  return (
    <>
      <Toasts />
      <HelpTooltips suppressKey={lessonTarget} disabled={help.helpMode} />
      <HelpMode active={help.helpMode} onExit={help.exit} onLearnMore={help.learnMore} />
    </>
  )
}

interface EditorScreen {
  readonly open: boolean
  show(): void
  /** Settles Kade's typing first, so the library (and anything added next) has the newest code. */
  close(): Promise<void>
}

function useEditorScreen(editor: EditorStore): EditorScreen {
  const open = useStore(editor, (s) => s.open)
  const show = useCallback(() => editor.getState().setOpen(true), [editor])
  const close = useCallback(async () => {
    await editor.getState().flush()
    editor.getState().setOpen(false)
  }, [editor])
  return { open, show, close }
}

interface DesignPanesProps {
  deps: AppDeps
  store: BloKadeStore
  actions: Actions
  shapes: ShapeSetup
  lessons: LessonStore
  session: DesignSession
}

/** The design screen's left, middle and right panes. */
function DesignPanes({ deps, store, actions, shapes, lessons, session }: DesignPanesProps) {
  return (
    <>
      <aside className="left-panel">
        <ShapePalette registry={shapes.registry} mine={shapes.registry.mine()} kits={KITS} onAdd={actions.addShape} onAddKit={actions.addKit} />
        <SceneTree registry={shapes.registry} />
      </aside>
      <main className="viewport" data-testid="viewport">
        <Viewport registry={shapes.registry} onToggleEdge={actions.togglePickedEdge} />
        <EmptyNudge lessons={lessons} onStart={() => {
          const first = TUTORIALS[0]
          if (first) void startLesson(session, lessons, first)
        }} />
        <NewerShapesBanner library={shapes.library} />
      </main>
      <aside className="right-panel">
        <PropertiesPanel registry={shapes.registry} onCheckOverlap={() => void checkOverlap(store, deps.client)} />
        <VariablesPanel registry={shapes.registry} />
      </aside>
    </>
  )
}

export function Workspace({ deps, lessons: injected }: { deps: AppDeps; lessons?: LessonStore }) {
  const store = useBloKadeStore()
  const shapes = useShapeSetup(deps, store)
  // Rebuilt whenever the shape list changes, so Add knows about shapes checked after the first render.
  const actions = useMemo(() => createActions(store, shapes.registry, shapes.carriedCodeOf), [store, shapes.registry, shapes.carriedCodeOf])
  const [showDesigns, setShowDesigns] = useState(false)
  useGeometrySync(store, deps.client)
  useEdgeCandidates(store, deps.client)
  const flushAutosave = useAutosave(store, deps.repo, deps.openTabChannel)
  const [lessons] = useState<LessonStore>(() => injected ?? createLessonStore(browserStorage(), ALL_LESSONS))
  const session = useMemo<DesignSession>(() => ({ repo: deps.repo, store, flushAutosave }), [deps.repo, store, flushAutosave])
  useStepWatcher(store, lessons)
  const lessonsOpen = useStore(lessons, (s) => s.panelOpen)
  const help = useHelpControls(lessons)
  const editor = useEditorScreen(shapes.editor)
  // The code box is typing, not design editing: Delete or Ctrl+Z there must never change the design.
  useShortcuts(actions, !showDesigns && !help.helpMode && !editor.open)
  const onExport = (format: ExportFormat): void => void exportDesign({ client: deps.client, store, format })
  const layers = <HelpLayers store={store} lessons={lessons} help={help} />

  if (editor.open) {
    return (
      <>
        <MyShapesScreen editor={shapes.editor} lessons={lessons} catalog={shapes.catalog} base={deps.registry} client={deps.client}
          helpMode={help.helpMode} onHelpMode={help.toggle} onBack={() => void editor.close()}
          onAdd={(id) => void editor.close().then(() => actions.addShape(id))} />
        {layers}
      </>
    )
  }
  return (
    <div className={lessonsOpen ? 'workspace with-lessons' : 'workspace'}>
      <Toolbar actions={actions} onExport={onExport} onOpenDesigns={() => setShowDesigns(true)}
        learnOpen={lessonsOpen} onLearn={() => lessons.getState().togglePanel()}
        helpMode={help.helpMode} onHelpMode={help.toggle} onMyShapes={editor.show} />
      <DesignPanes deps={deps} store={store} actions={actions} shapes={shapes} lessons={lessons} session={session} />
      {lessonsOpen && <LessonsPanel lessons={lessons} session={session} />}
      {showDesigns && <DesignsDialog repo={deps.repo} flushAutosave={flushAutosave} onClose={() => setShowDesigns(false)} />}
      {layers}
    </div>
  )
}
