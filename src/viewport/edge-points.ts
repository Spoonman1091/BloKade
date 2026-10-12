/** Flat x,y,z numbers → points for drei's <Line>. */
export function pointsOf(flat: readonly number[]): [number, number, number][] {
  return Array.from({ length: Math.floor(flat.length / 3) }, (_, i) => [flat[i * 3] ?? 0, flat[i * 3 + 1] ?? 0, flat[i * 3 + 2] ?? 0])
}

/** Smallest gap (mm) between a face hit and an edge hit that counts as "the face is in front". */
const MIN_HIDE_GAP = 0.5
/** The gap grows with distance, because clicks far away are less precise. */
const HIDE_GAP_PER_MM = 0.01

export function edgeHitTolerance(lineDistance: number): number {
  return Math.max(MIN_HIDE_GAP, lineDistance * HIDE_GAP_PER_MM)
}

/** Lines are hit even behind faces; an edge click counts only when no face was hit clearly nearer the camera. */
export function isEdgeHitVisible(lineDistance: number, meshDistances: readonly number[], tolerance: number): boolean {
  return !meshDistances.some((d) => d < lineDistance - tolerance)
}
