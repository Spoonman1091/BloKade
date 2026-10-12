/** The code every new shape starts with. */
export const NEW_SHAPE_CODE = `export default {
  name: 'My shape',
  icon: '🧩',
  settings: {
    size: { type: 'mm', default: 20, label: 'Size' },
  },
  build({ size }, cad) {
    return cad.box(size, size, size)
  },
}
`

/** The first `name: '…'` (or "…") in the code: the shape's name. */
const NAME_IN_CODE = /(\bname\s*:\s*)(['"])((?:\\.|(?!\2)[^\\\n])*)\2/

export function nameInCode(code: string): string | null {
  return code.match(NAME_IN_CODE)?.[3]?.trim() || null
}

/** The code with its shape name changed, quoting it safely. Code without a name is left alone. */
export function renameInCode(code: string, name: string): string {
  return code.replace(NAME_IN_CODE, (_match, start: string, quote: string) =>
    `${start}${quote}${name.replaceAll('\\', '\\\\').replaceAll(quote, `\\${quote}`)}${quote}`)
}

export function uniqueName(base: string, taken: readonly string[]): string {
  if (!taken.includes(base)) return base
  for (let n = 2; ; n += 1) {
    const name = `${base} ${n}`
    if (!taken.includes(name)) return name
  }
}
