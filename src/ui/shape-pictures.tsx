import type { ReactNode } from 'react'

/** Small drawings for the More shapes buttons: seen from the front, a lighter top or side face to read as 3D. */
function Svg({ children }: { readonly children: ReactNode }) {
  return (
    <svg className="palette-picture" viewBox="0 0 24 24" width="1em" height="1em" aria-hidden="true">
      <g strokeWidth="0.8" strokeLinejoin="round">{children}</g>
    </svg>
  )
}

// One main colour per shape, a lighter shade for the lit face, a darker stroke.
const edge = (stroke: string) => ({ stroke })

export function RoofPicture() {
  return (
    <Svg>
      <path d="M2 21V12L12 4L22 12V21Z" fill="#e0675a" {...edge('#8f3128')} />
      <path d="M12 4L22 12V21L12 13Z" fill="#f08a7e" {...edge('#8f3128')} />
    </Svg>
  )
}

export function RoundRoofPicture() {
  return (
    <Svg>
      <path d="M2 20V13A8 8 0 0 1 18 13V20Z" fill="#d98a3d" {...edge('#8a5314')} />
      <path d="M18 13A8 8 0 0 0 14 6.1L22 9V16L18 20Z" fill="#efb069" {...edge('#8a5314')} />
    </Svg>
  )
}

export function TubePicture() {
  return (
    <Svg>
      <path d="M4 8V18A8 3.5 0 0 0 20 18V8Z" fill="#4fa3b8" {...edge('#1f6578')} />
      <ellipse cx="12" cy="8" rx="8" ry="3.5" fill="#8fd0e0" {...edge('#1f6578')} />
      <ellipse cx="12" cy="8" rx="4.6" ry="1.9" fill="#1f6578" {...edge('#1f6578')} />
    </Svg>
  )
}

export function HalfSpherePicture() {
  return (
    <Svg>
      <path d="M2 17A10 10 0 0 1 22 17A10 3.2 0 0 1 2 17Z" fill="#7b6fd0" {...edge('#3c3382')} />
      <path d="M5.5 11A8 8 0 0 1 12 7.5" fill="none" stroke="#b9b1f0" strokeLinecap="round" />
    </Svg>
  )
}

export function PyramidPicture() {
  return (
    <Svg>
      <path d="M12 3L2 19L12 22Z" fill="#c9a24a" {...edge('#7a5d14')} />
      <path d="M12 3L22 19L12 22Z" fill="#e6c878" {...edge('#7a5d14')} />
    </Svg>
  )
}

export function PolygonPicture() {
  return (
    <Svg>
      <path d="M6.5 6H17.5L22 12.5L17.5 19H6.5L2 12.5Z" fill="#4aa86a" {...edge('#1d6a37')} />
      <path d="M6.5 6H17.5L22 12.5H2Z" fill="#82d29c" {...edge('#1d6a37')} />
    </Svg>
  )
}

export function ParaboloidPicture() {
  return (
    <Svg>
      <path d="M2.5 18C2.5 9 8 3 12 3S21.5 9 21.5 18A9.5 3.5 0 0 1 2.5 18Z" fill="#d56a9a" {...edge('#8a2e5a')} />
      <path d="M8 16C8 10 9.6 6.5 11 5" fill="none" stroke="#f3b0cd" strokeLinecap="round" />
    </Svg>
  )
}

export function StarPicture() {
  return (
    <Svg>
      <path d="M12 2L14.9 8.6L22 9.3L16.6 14L18.2 21L12 17.3L5.8 21L7.4 14L2 9.3L9.1 8.6Z" fill="#f2c230" {...edge('#9a7300')} />
      <path d="M12 2L14.9 8.6L12 12.2L9.1 8.6Z" fill="#f9dc7a" strokeWidth="0.4" {...edge('#9a7300')} />
    </Svg>
  )
}

export function HeartPicture() {
  return (
    <Svg>
      <path d="M12 21L3.2 12.3A5.2 5.2 0 0 1 12 6.2A5.2 5.2 0 0 1 20.8 12.3Z" fill="#e0405a" {...edge('#8c1a30')} />
      <path d="M6 9.5A3 3 0 0 1 9.6 8" fill="none" stroke="#f59aab" strokeLinecap="round" />
    </Svg>
  )
}

export function IcosahedronPicture() {
  return (
    <Svg>
      <path d="M12 2L21 7.5V16.5L12 22L3 16.5V7.5Z" fill="#8a97b0" {...edge('#46526b')} />
      <path d="M12 2L21 7.5L12 12Z" fill="#b5bfd2" {...edge('#46526b')} />
      <path d="M3 7.5L12 12L3 16.5Z" fill="#6f7c96" {...edge('#46526b')} />
      <path d="M12 12L21 16.5L12 22L3 16.5Z" fill="#9aa6bd" {...edge('#46526b')} />
    </Svg>
  )
}

export const SHAPE_PICTURES: Readonly<Record<string, () => ReactNode>> = {
  roof: RoofPicture,
  'round-roof': RoundRoofPicture,
  tube: TubePicture,
  'half-sphere': HalfSpherePicture,
  pyramid: PyramidPicture,
  polygon: PolygonPicture,
  paraboloid: ParaboloidPicture,
  star: StarPicture,
  heart: HeartPicture,
  icosahedron: IcosahedronPicture,
}
