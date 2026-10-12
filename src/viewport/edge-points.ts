/** Flat x,y,z numbers → points for drei's <Line>. */
export function pointsOf(flat: readonly number[]): [number, number, number][] {
  return Array.from({ length: Math.floor(flat.length / 3) }, (_, i) => [flat[i * 3] ?? 0, flat[i * 3 + 1] ?? 0, flat[i * 3 + 2] ?? 0])
}
