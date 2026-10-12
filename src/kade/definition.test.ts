import { describe, expect, it } from 'vitest'
import { NO_BUILD, NO_EXPORT, NO_NAME, readShapeDefinition } from './definition'

const build = () => null
const read = (definition: unknown) => readShapeDefinition({ default: definition })
const problem = (definition: unknown): string => {
  const result = read(definition)
  return result.ok ? 'no problem' : result.error
}

describe('readShapeDefinition', () => {
  it('reads a full definition', () => {
    const result = read({
      name: ' Robot head ', icon: '🤖', build,
      settings: { size: { type: 'mm', default: 20, label: 'Size' } },
      size: { x: 'size', z: 'size' }, mode: 'hole', palette: 'fit',
    })
    expect(result.ok && result.value.meta).toEqual({
      name: 'Robot head', icon: '🤖', params: { size: { type: 'mm', default: 20, label: 'Size' } },
      size: { x: 'size', z: 'size' }, mode: 'hole', palette: 'fit',
    })
    expect(result.ok && result.value.build).toBe(build)
  })
  it('accepts params as another name for settings, and fills in the icon', () => {
    const result = read({ name: 'A', build, params: { w: { type: 'mm', default: 1 } } })
    expect(result.ok && result.value.meta).toEqual({ name: 'A', icon: '🧩', params: { w: { type: 'mm', default: 1, label: 'w' } } })
  })
  it('treats mode solid as the normal mode', () => {
    const result = read({ name: 'A', build, mode: 'solid' })
    expect(result.ok && result.value.meta.mode).toBeUndefined()
  })
  it('explains what is missing or wrong', () => {
    expect(readShapeDefinition({})).toEqual({ ok: false, error: NO_EXPORT })
    expect(problem(5)).toBe(NO_EXPORT)
    expect(problem({ build })).toBe(NO_NAME)
    expect(problem({ name: '   ', build })).toBe(NO_NAME)
    expect(problem({ name: 'x'.repeat(61), build })).toBe('Shape names can be up to 60 letters long.')
    expect(problem({ name: 'A' })).toBe(NO_BUILD)
    expect(problem({ name: 'A', build: 'cad.box(1, 1, 1)' })).toBe(NO_BUILD)
    expect(problem({ name: 'A', build, settings: { s: { type: 'mm' } } })).toContain('needs a number default')
    expect(problem({ name: 'A', build, mode: 'ghost' })).toBe("mode can be 'solid' or 'hole'.")
    expect(problem({ name: 'A', build, palette: 'top' })).toBe("palette can be 'shapes' or 'fit'.")
  })
  it('checks size handles point at number settings', () => {
    const settings = { words: { type: 'text', default: 'Hi' }, w: { type: 'mm', default: 5 } }
    expect(problem({ name: 'A', build, settings, size: { x: 'width' } })).toBe('size.x points at "width", but there\'s no setting called "width".')
    expect(problem({ name: 'A', build, settings, size: { y: 'words' } })).toBe('size.y can only change a number setting, and "words" is a text setting.')
    expect(problem({ name: 'A', build, settings, size: { z: 5 } })).toBe("size.z needs a setting name in quotes, like z: 'width'.")
    expect(problem({ name: 'A', build, settings, size: 'w' })).toContain('size needs curly brackets')
  })
})
