import { describe, expect, it } from 'vitest'
import { pluginProblems, registry } from './index'

describe('plugin bootstrap', () => {
  it('loads without reporting problems', () => {
    expect(pluginProblems).toEqual([])
  })

  it('returns undefined for an unknown plugin id', () => {
    expect(registry.get('no-such-plugin')).toBeUndefined()
  })
})
