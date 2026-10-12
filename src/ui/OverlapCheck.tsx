import { useBloKade } from '../store/context'
import { visibleOverlap } from '../store/overlap'

const formatVolume = (volume: number): string => (volume < 0.1 ? 'less than 0.1' : String(Math.round(volume * 10) / 10))

/** "Do these two parts run into each other?" — with the answer shown while it's still true. */
export function OverlapCheck({ onCheck }: { onCheck(): void }) {
  const overlap = useBloKade((s) => s.overlap)
  const present = useBloKade((s) => s.history.present)
  const selection = useBloKade((s) => s.selection)
  const result = visibleOverlap({ overlap, present, selection })
  return (
    <div className="overlap-check">
      <h3>Fit check</h3>
      <button type="button" className="tool-button" data-testid="check-overlap" onClick={onCheck}>🔍 Check overlap</button>
      {result && (
        <p className="hint" data-testid="overlap-result" role="status">
          {result.status === 'overlap'
            ? `These overlap by ${formatVolume(result.volume)} mm³ (shown in red).`
            : "No overlap — they don't run into each other."}
        </p>
      )}
    </div>
  )
}
