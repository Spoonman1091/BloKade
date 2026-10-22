/** The first dropped file whose name ends in .stl (any case), if there is one. */
export function stlFileOf(files: FileList | readonly File[]): File | undefined {
  return Array.from(files).find((file) => /\.stl$/i.test(file.name))
}

/** Handles a drop on the 3D view: the browser never opens the file, and only an STL is chosen. */
export function handleStlDrop(
  event: { preventDefault(): void; dataTransfer: { files: FileList | readonly File[] } },
  choose: (file: File) => void,
): void {
  event.preventDefault()
  const file = stlFileOf(event.dataTransfer.files)
  if (file) choose(file)
}
