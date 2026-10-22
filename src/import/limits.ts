/** Biggest STL file BloKade will open. */
export const MAX_STL_BYTES = 50 * 1024 * 1024
/** Most triangles one imported model keeps. Lowered from 10,000 after timing group builds (see mesh-solid.timing.test.ts). */
export const MAX_IMPORT_TRIANGLES = 5000
/** Most triangles a stored model may have; designs saved with up to this many must still open. */
export const MAX_STORED_TRIANGLES = 10000
/** Most vertices a stored model may have (three per triangle at worst). */
export const MAX_STORED_VERTICES = MAX_STORED_TRIANGLES * 3
/** Most imported models in one project. */
export const MAX_MODELS = 20

export const TOO_BIG_FILE = 'This file is too big for BloKade (over 50 MB).'
export const NOT_STL = "BloKade couldn't read this file. Is it an STL?"
export const NO_TRIANGLES = 'This file has no shape in it.'
export const HAS_GAPS_NOTE = 'This model has gaps in its surface, so holes might not cut it properly.'
export const TOO_LARGE_SIZE = 'This is bigger than BloKade allows (2000 mm). Try another unit.'

/** The note shown when a model was simplified down to `count` triangles. */
export function simplifiedNote(count: number): string {
  return `This model was very detailed, so BloKade simplified it to ${count.toLocaleString('en-US')} triangles. It will look a little smoother.`
}
export const TOO_DETAILED = "This model is too detailed for BloKade, even after simplifying it."
export const FLAT_MODEL = "This model is completely flat, so BloKade can't make a solid from it."
