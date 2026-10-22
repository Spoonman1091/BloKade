/** The first dropped file whose name ends in .stl (any case), if there is one. */
export function stlFileOf(files: FileList | readonly File[]): File | undefined {
  return Array.from(files).find((file) => /\.stl$/i.test(file.name))
}
