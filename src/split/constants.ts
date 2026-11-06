/** Every number and message the split tool uses, in one place. Lengths are mm. */
export const MARGIN = 5
export const TAB_LENGTH = 10
export const TAB_TIP = 10
export const TAB_NECK = 6
export const TAB_SPACING = 45
export const TONGUE_OUT = 3
export const TONGUE_MIN_BASE = 4
export const BASE_COVERAGE = 0.95
export const BASE_STEP = 0.1
export const RAISED_PROBE = 0.2
export const ENGRAVE_DEPTH = 0.6
export const DIGIT_HEIGHT = 8
export const MAX_GRID = 6
export const SCORE_STEP = 1
export const BALANCE_WEIGHT = 0.1
export const DEFAULT_FIT_GAP = 0.2

export const GAPS_MESSAGE = "This model has gaps in its surface, so it can't be cut cleanly. Open it in Bambu Studio, use Repair, save it, and try again."
export const NO_PRINTER_MESSAGE = 'Pick your printer in the toolbar first, so BloKade knows how big the pieces can be.'
export const TOO_MANY_MESSAGE = 'This model would need more than 36 pieces. Try a bigger printer or scale it down first.'
export const NO_BASE_MESSAGE = "This model doesn't have a flat base, so the pieces get straight cuts. Glue them together."
export const THIN_TONGUE_MESSAGE = 'The base is too thin for a tongue.'
export const UNEXPECTED_MESSAGE = "Couldn't split this model. Try again, or open it in Bambu Studio and use Cut there."
