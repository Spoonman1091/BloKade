import type { NodeId } from '../document/types'
import { RichText } from '../ui/RichText'

/** The red bar above the 3D view. Parts hanging off the plate get a button that brings them back. */
export function FitWarning({ warning, offPlateIds, onPutOnPlate }: {
  warning: string | null
  offPlateIds: ReadonlySet<NodeId>
  onPutOnPlate(ids: readonly NodeId[]): void
}) {
  if (!warning) return null
  return (
    <div className="viewport-warning" role="alert" data-testid="fit-warning" data-help="fit-warning">
      <RichText text={warning} />
      {offPlateIds.size > 0 && (
        <button type="button" className="viewport-warning-button" data-testid="fit-put-on-plate" data-help="fit-put-on-plate"
          onClick={() => onPutOnPlate([...offPlateIds])}>Put on plate</button>
      )}
    </div>
  )
}
