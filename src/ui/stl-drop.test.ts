import { describe, expect, it } from 'vitest'
import { stlFileOf } from './stl-drop'

describe('stlFileOf', () => {
  it('takes the first .stl file, in any case', () => {
    const files = [new File([], 'a.png'), new File([], 'B.STL'), new File([], 'c.stl')]
    expect(stlFileOf(files)?.name).toBe('B.STL')
  })
  it('returns nothing when no file is an STL', () => {
    expect(stlFileOf([new File([], 'a.png')])).toBeUndefined()
  })
})
