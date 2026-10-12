import { useEffect, useState, type KeyboardEvent } from 'react'
import { formatNumber, parseNumberInput } from './number-input'

interface DraftFieldProps<T> {
  label: string
  value: T
  onCommit(value: T): void
  testId?: string
  format(value: T): string
  parse(text: string): T | null
}

/** Text input holding a draft; commits valid changes on Enter/blur, reverts junk and on Escape. */
function DraftField<T>({ label, value, onCommit, testId, format, parse }: DraftFieldProps<T>) {
  const [draft, setDraft] = useState(format(value))
  useEffect(() => setDraft(format(value)), [value, format])

  const commit = (): void => {
    const parsed = parse(draft)
    if (parsed === null) {
      setDraft(format(value))
      return
    }
    if (parsed !== value) onCommit(parsed)
  }
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'Enter') commit()
    if (event.key === 'Escape') setDraft(format(value))
  }

  return (
    <label className="field">
      <span>{label}</span>
      <input
        type="text"
        inputMode="decimal"
        data-testid={testId}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={onKeyDown}
      />
    </label>
  )
}

type FieldProps<T> = Omit<DraftFieldProps<T>, 'format' | 'parse'>

const identity = (text: string): string => text
const nonEmpty = (text: string): string | null => (text.trim() ? text.trim() : null)

export function NumberField(props: FieldProps<number>) {
  return <DraftField {...props} format={formatNumber} parse={parseNumberInput} />
}

export function TextField(props: FieldProps<string>) {
  return <DraftField {...props} format={identity} parse={nonEmpty} />
}
