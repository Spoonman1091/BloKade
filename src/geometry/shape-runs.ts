/**
 * A note the worker sends the page as Kade's code (by code hash) starts or stops running.
 * It has no Comlink id, so Comlink lets it pass. If the worker gets stuck, the page knows which code it was running.
 */
export interface ShapeRunMessage {
  readonly kadeShape: string
  readonly running: boolean
}

export const shapeRunMessage = (hash: string, running: boolean): ShapeRunMessage => ({ kadeShape: hash, running })

export function isShapeRunMessage(data: unknown): data is ShapeRunMessage {
  if (typeof data !== 'object' || data === null) return false
  const { kadeShape, running } = data as Partial<Record<keyof ShapeRunMessage, unknown>>
  return typeof kadeShape === 'string' && typeof running === 'boolean'
}

/** The page's view of which of Kade's code one worker is running right now. */
export class RunningShapes {
  private counts: ReadonlyMap<string, number> = new Map()

  note({ kadeShape, running }: ShapeRunMessage): void {
    const count = (this.counts.get(kadeShape) ?? 0) + (running ? 1 : -1)
    const next = new Map(this.counts)
    if (count > 0) next.set(kadeShape, count)
    else next.delete(kadeShape)
    this.counts = next
  }

  list(): readonly string[] {
    return [...this.counts.keys()]
  }
}
