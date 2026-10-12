import { loadFont } from 'replicad'

/** The font family Text shapes use. */
export const TEXT_FONT = 'blokade'

/** Registers BloKade's bundled font with replicad. Call once per worker before building Text shapes. */
export async function registerFont(data: ArrayBuffer): Promise<void> {
  await loadFont(data, TEXT_FONT)
}
