import { useEffect, useState } from 'react'

/** True while Shift is held; used to turn snapping off during a drag. */
export function useShiftHeld(): boolean {
  const [held, setHeld] = useState(false)
  useEffect(() => {
    const update = (event: KeyboardEvent): void => setHeld(event.shiftKey)
    const reset = (): void => setHeld(false)
    window.addEventListener('keydown', update)
    window.addEventListener('keyup', update)
    window.addEventListener('blur', reset)
    return () => {
      window.removeEventListener('keydown', update)
      window.removeEventListener('keyup', update)
      window.removeEventListener('blur', reset)
    }
  }, [])
  return held
}
