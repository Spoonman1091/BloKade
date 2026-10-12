import type { CodeView } from '../kade/code-view'
import { problemLine } from '../kade/errors'

/** Under the code box: the one problem to fix (click it to jump to its line), or a ✓ when the shape works. */
export function ProblemList({ view, onJump }: { view: CodeView; onJump(line: number): void }) {
  if (!view.shapeId) return null
  if (view.problem) {
    const line = problemLine(view.problem)
    return (
      <div className="problem-list" role="alert" data-testid="code-problems">
        {line === null
          ? <p className="error-text">⚠ {view.problem}</p>
          : <button type="button" className="problem" data-testid="problem-0" onClick={() => onJump(line)}>⚠ {view.problem}</button>}
      </div>
    )
  }
  if (view.built) return <p className="code-ok" data-testid="code-ok" role="status">✓ Your shape works!</p>
  return <p className="hint" data-testid="code-checking" role="status">Checking your shape…</p>
}
