import { useMemo } from 'react'
import { outdatedShapes, withNewestVersions } from '../kade/carried'
import type { LibraryShape } from '../kade/library'
import { useBloKade } from '../store/context'

/** Shown when Kade changed one of their shapes after putting it in this design. */
export function NewerShapesBanner({ library }: { library: readonly LibraryShape[] }) {
  const doc = useBloKade((s) => s.history.present)
  const apply = useBloKade((s) => s.apply)
  const outdated = useMemo(() => outdatedShapes(doc, library), [doc, library])
  if (outdated.length === 0) return null
  const names = outdated.map((s) => s.name).join(', ')
  const message = outdated.length === 1 ? `${names} has a newer version in My shapes.` : `${names} have newer versions in My shapes.`
  return (
    <div className="newer-shapes" role="status" data-testid="newer-shapes">
      <span>{message}</span>
      <button type="button" className="tool-button primary" data-testid="use-newest"
        onClick={() => apply((d) => withNewestVersions(d, library))}>Use my newest version</button>
    </div>
  )
}
