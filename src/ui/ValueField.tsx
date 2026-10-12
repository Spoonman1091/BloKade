import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { formatNumber } from './number-input'

interface ValueFieldProps {
  label: string
  /** The number the field holds: what was typed, or a formula's last good result. */
  value: number
  /** Formula text, when the field uses one. */
  formula?: string
  /** Why the formula doesn't work right now. */
  error?: string
  testId: string
  onCommit(text: string): void
}

/** Takes a number or a formula. Commits on Enter or leaving the field; Escape throws the typing away. */
export function ValueField({ label, value, formula, error, testId, onCommit }: ValueFieldProps) {
  const shown = formula ?? formatNumber(value)
  const [draft, setDraft] = useState(shown)
  useEffect(() => setDraft(shown), [shown])
  // True only while the user has typed something that hasn't been committed yet, so a blur right after Enter can't re-commit.
  const dirty = useRef(false)

  const commit = (): void => {
    if (!dirty.current) return
    dirty.current = false
    const text = draft.trim()
    // Always show the model's value afterwards; a real change refreshes it through the effect above.
    setDraft(shown)
    if (text !== '' && text !== shown) onCommit(text)
  }
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'Enter') commit()
    if (event.key === 'Escape') {
      dirty.current = false
      setDraft(shown)
    }
  }

  return (
    <div className="value-field">
      <label className="field">
        <span>{label}</span>
        <input
          type="text"
          spellCheck={false}
          data-testid={testId}
          value={draft}
          aria-invalid={error ? true : undefined}
          onChange={(event) => {
            dirty.current = true
            setDraft(event.target.value)
          }}
          onBlur={commit}
          onKeyDown={onKeyDown}
        />
      </label>
      {error && <p className="field-error" data-testid={`${testId}-error`}>⚠ {error}</p>}
      {!error && formula !== undefined && <p className="field-note" data-testid={`${testId}-value`}>= {formatNumber(value)}</p>}
    </div>
  )
}
