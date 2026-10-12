import { useEffect } from 'react'
import { useBloKade } from '../store/context'

export const NOTICE_DURATION_MS = 8000

export function Toasts() {
  const notice = useBloKade((s) => s.notice)
  const notify = useBloKade((s) => s.notify)

  useEffect(() => {
    if (!notice) return undefined
    const timer = setTimeout(() => notify(null), NOTICE_DURATION_MS)
    return () => clearTimeout(timer)
  }, [notice, notify])

  if (!notice) return null
  return (
    <div className="toast" role="status">
      <span>{notice}</span>
      <button type="button" aria-label="Dismiss message" onClick={() => notify(null)}>✕</button>
    </div>
  )
}
