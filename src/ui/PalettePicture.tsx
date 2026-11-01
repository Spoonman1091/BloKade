import type { ReactNode } from 'react'

/** A peg hanging over the block with its socket, cut open so the hole shows. No emoji looks like one. */
function PegAndSocket() {
  return (
    <svg className="palette-picture" viewBox="0 0 24 24" width="1em" height="1em" aria-hidden="true">
      <path d="M2 12H8.5V19H15.5V12H22V22H2Z" fill="#8a9bb0" stroke="#4a5868" strokeWidth="0.8" strokeLinejoin="round" />
      <path d="M9.6 1.5H14.4V9.2L13.6 10H10.4L9.6 9.2Z" fill="#f08c00" stroke="#a35f00" strokeWidth="0.8" strokeLinejoin="round" />
    </svg>
  )
}

const PICTURES: Readonly<Record<string, () => ReactNode>> = { 'peg-socket': PegAndSocket }

/** The drawn picture for a known id, otherwise its emoji. */
export function palettePicture(id: string, emoji: string): ReactNode {
  const Picture = PICTURES[id]
  return Picture ? <Picture /> : emoji
}
