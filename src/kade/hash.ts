/** FNV-1a hash of the code plus its length. Used as a cache key and as a shape's revision. */
export function codeHash(code: string): string {
  let hash = 0x811c9dc5
  for (let i = 0; i < code.length; i += 1) {
    hash ^= code.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return `${(hash >>> 0).toString(16).padStart(8, '0')}-${code.length.toString(36)}`
}
