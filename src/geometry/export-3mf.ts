import { strToU8, zipSync } from 'fflate'

const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/>
</Types>`

const RELS = `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/>
</Relationships>`

const escapeXml = (text: string): string =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;')

const num = (v: number | undefined): string => String(Math.round((v ?? 0) * 1e5) / 1e5)

function modelXml(mesh: { vertices: ArrayLike<number>; triangles: ArrayLike<number> }, title: string): string {
  const vertices: string[] = []
  for (let i = 0; i + 2 < mesh.vertices.length; i += 3) {
    vertices.push(`<vertex x="${num(mesh.vertices[i])}" y="${num(mesh.vertices[i + 1])}" z="${num(mesh.vertices[i + 2])}"/>`)
  }
  const triangles: string[] = []
  for (let i = 0; i + 2 < mesh.triangles.length; i += 3) {
    triangles.push(`<triangle v1="${mesh.triangles[i]}" v2="${mesh.triangles[i + 1]}" v3="${mesh.triangles[i + 2]}"/>`)
  }
  return `<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">
  <metadata name="Title">${escapeXml(title)}</metadata>
  <resources>
    <object id="1" type="model">
      <mesh>
        <vertices>${vertices.join('')}</vertices>
        <triangles>${triangles.join('')}</triangles>
      </mesh>
    </object>
  </resources>
  <build><item objectid="1"/></build>
</model>`
}

/** Packs an indexed triangle mesh (mm) into a 3MF file. */
export function write3mf(mesh: { vertices: ArrayLike<number>; triangles: ArrayLike<number> }, title: string): Uint8Array {
  return zipSync({
    '[Content_Types].xml': strToU8(CONTENT_TYPES),
    '_rels/.rels': strToU8(RELS),
    '3D/3dmodel.model': strToU8(modelXml(mesh, title)),
  })
}
