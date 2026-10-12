import { readFile } from 'node:fs/promises'
import { registerFont } from '../../plugins/font'

let ready: Promise<void> | null = null

/** Loads the bundled font into replicad for Node-based tests (once per test worker). */
export function loadTestFont(): Promise<void> {
  ready ??= readFile(new URL('../../assets/fonts/AtkinsonHyperlegible-Bold.ttf', import.meta.url)).then((bytes) =>
    registerFont(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer))
  return ready
}
