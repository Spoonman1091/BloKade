// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { HELP_TEXTS } from './help-texts'
import { helpFor, helpKeyOf } from './lookup'

describe('helpFor', () => {
  it('has help for the 3D view', () => {
    expect(helpFor('viewport')).not.toBeNull()
  })

  it('finds exact help', () => {
    expect(helpFor('mode-hole')?.tip).toBe(HELP_TEXTS['mode-hole']?.tip)
  })

  it('fills in names for families of controls', () => {
    expect(helpFor('add-cylinder', 'Cylinder')?.tip).toBe('Adds a Cylinder to your design.')
    expect(helpFor('add-kit-peg-socket', 'Peg & socket')?.tip).toBe('Adds a matched Peg & socket set that fits together.')
    expect(helpFor('param-width', 'Width (mm)')?.tip).toBe('Changes Width (mm). Type a number or a formula, then press Enter.')
    expect(helpFor('mod-radius-0')).not.toBeNull()
    expect(helpFor('mod-spacing-x-1')).not.toBeNull()
    expect(helpFor('align-x-min')).not.toBeNull()
    expect(helpFor('lesson-start-first-shape', 'Start')).not.toBeNull()
  })

  it('has no help for unknown ids', () => {
    expect(helpFor('nope')).toBeNull()
  })

  it('keeps every tip to one short sentence', () => {
    for (const [key, entry] of Object.entries(HELP_TEXTS)) {
      expect(entry.tip.length, key).toBeLessThanOrEqual(110)
      expect(entry.card.length, key).toBeGreaterThan(entry.tip.length - 1)
    }
  })
})

describe('helpKeyOf', () => {
  it('uses the nearest data-help or data-testid, and visible text as the label', () => {
    document.body.innerHTML = `
      <button data-testid="add-box"><span aria-hidden="true">🟦</span>Box</button>
      <label class="field"><span>Width (mm)</span><input data-testid="param-width"></label>
      <h2 data-help="panel-parts">Parts <em id="inner">here</em></h2>`
    const button = document.querySelector('[data-testid="add-box"] span')
    expect(button && helpKeyOf(button)).toMatchObject({ key: 'add-box', label: 'Box' })
    const input = document.querySelector('input')
    expect(input && helpKeyOf(input)).toMatchObject({ key: 'param-width', label: 'Width (mm)' })
    const inner = document.getElementById('inner')
    expect(inner && helpKeyOf(inner)?.key).toBe('panel-parts')
    expect(helpKeyOf(document.body)).toBeNull()
  })
})
