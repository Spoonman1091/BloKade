import { validateDocument } from '../document/schema'
import type { BloKadeDocument } from '../document/types'
import { fail, ok, type Result } from '../shared/result'
import { migrateDocument } from './migrate'

export function parseDesign(raw: unknown): Result<BloKadeDocument> {
  const migrated = migrateDocument(raw)
  return migrated.ok ? validateDocument(migrated.value) : migrated
}

function parseJson(text: string): Result<unknown> {
  try {
    return ok(JSON.parse(text))
  } catch {
    return fail("This file isn't a BloKade design.")
  }
}

export function parseDesignFile(text: string): Result<BloKadeDocument> {
  const json = parseJson(text)
  return json.ok ? parseDesign(json.value) : json
}

export const serializeDesign = (doc: BloKadeDocument): string => JSON.stringify(doc, null, 2)

export function fileNameFor(doc: BloKadeDocument, extension: 'blokade' | 'stl' | '3mf'): string {
  const slug = doc.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  return `${slug || 'design'}.${extension}`
}
