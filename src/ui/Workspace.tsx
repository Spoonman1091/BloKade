import { useCallback, useMemo, useState } from 'react'
import { useStore } from 'zustand'
import { checkOverlap } from '../app/check-overlap'
import { createActions } from '../app/actions'
import type { AppDeps } from '../app/deps'
import type { DesignSession } from '../app/design-session'
import { exportDesign, type ExportFormat } from '../app/export'
import { useShortcuts } from '../app/shortcuts'
import { useAutosave } from '../app/useAutosave'
import { useEdgeCandidates } from '../app/useEdgeCandidates'
import { useGeometrySync } from '../app/useGeometrySync'
import { createLessonStore, currentStepOf, type LessonStore } from '../learn/lesson-store'
import { startLesson } from '../learn/start-lesson'
import { TUTORIALS } from '../learn/tutorials'
import { browserStorage } from '../learn/progress'
import { useStepWatcher } from '../learn/watch-steps'
import { useBloKadeStore } from '../store/context'
import { Viewport } from '../viewport/Viewport'
import { DesignsDialog } from './DesignsDialog'
import { EmptyNudge } from './EmptyNudge'
import { HelpMode } from './HelpMode'
import { HelpTooltips } from './HelpTooltips'
import { LessonsPanel } from './LessonsPanel'
import { PropertiesPanel } from './PropertiesPanel'
import { SceneTree } from './SceneTree'
import { KITS } from '../plugins/kits'
import { ShapePalette } from './ShapePalette'
import { Toasts } from './Toasts'
import { Toolbar } from './Toolbar'
import { VariablesPanel } from './VariablesPanel'

export function Workspace({ deps, lessons: injected }: { deps: AppDeps; lessons?: LessonStore }) {
  const store = useBloKadeStore()
  const actions = useMemo(() => createActions(store, deps.registry), [store, deps.registry])
  const [showDesigns, setShowDesigns] = useState(false)
  useGeometrySync(store, deps.client)
  useEdgeCandidates(store, deps.client)
  const flushAutosave = useAutosave(store, deps.repo, deps.openTabChannel)
  const [lessons] = useState<LessonStore>(() => injected ?? createLessonStore(browserStorage()))
  const session = useMemo<DesignSession>(() => ({ repo: deps.repo, store, flushAutosave }), [deps.repo, store, flushAutosave])
  useStepWatcher(store, lessons)
  const lessonsOpen = useStore(lessons, (s) => s.panelOpen)
  const [helpMode, setHelpMode] = useState(false)
  const exitHelp = useCallback(() => setHelpMode(false), [])
  const lessonTarget = useStore(lessons, (s) => currentStepOf(s.progress)?.target ?? null)
  const learnMore = useCallback((tutorialId: string) => {
    setHelpMode(false)
    lessons.getState().openPanel(tutorialId)
  }, [lessons])
  useShortcuts(actions, !showDesigns && !helpMode)
  const onExport = (format: ExportFormat): void => void exportDesign({ client: deps.client, store, format })

  return (
    <div className={lessonsOpen ? 'workspace with-lessons' : 'workspace'}>
      <Toolbar actions={actions} onExport={onExport} onOpenDesigns={() => setShowDesigns(true)}
        learnOpen={lessonsOpen} onLearn={() => lessons.getState().togglePanel()}
        helpMode={helpMode} onHelpMode={() => setHelpMode((on) => !on)} />
      <aside className="left-panel">
        <ShapePalette registry={deps.registry} kits={KITS} onAdd={actions.addShape} onAddKit={actions.addKit} />
        <SceneTree registry={deps.registry} />
      </aside>
      <main className="viewport" data-testid="viewport">
        <Viewport registry={deps.registry} onToggleEdge={actions.togglePickedEdge} />
        <EmptyNudge lessons={lessons} onStart={() => {
          const first = TUTORIALS[0]
          if (first) void startLesson(session, lessons, first)
        }} />
      </main>
      <aside className="right-panel">
        <PropertiesPanel registry={deps.registry} onCheckOverlap={() => void checkOverlap(store, deps.client)} />
        <VariablesPanel registry={deps.registry} />
      </aside>
      {lessonsOpen && <LessonsPanel lessons={lessons} session={session} />}
      {showDesigns && <DesignsDialog repo={deps.repo} flushAutosave={flushAutosave} onClose={() => setShowDesigns(false)} />}
      <Toasts />
      <HelpTooltips suppressKey={lessonTarget} disabled={helpMode} />
      <HelpMode active={helpMode} onExit={exitHelp} onLearnMore={learnMore} />
    </div>
  )
}
