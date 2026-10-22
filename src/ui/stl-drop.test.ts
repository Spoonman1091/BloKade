import { describe, expect, it } from 'vitest'
import { vi } from 'vitest'
import { handleStlDrop, stlFileOf } from './stl-drop'

describe('stlFileOf', () => {
  it('takes the first .stl file, in any case', () => {
    const files = [new File([], 'a.png'), new File([], 'B.STL'), new File([], 'c.stl')]
    expect(stlFileOf(files)?.name).toBe('B.STL')
  })
  it('returns nothing when no file is an STL', () => {
    expect(stlFileOf([new File([], 'a.png')])).toBeUndefined()
  })
})

describe('handleStlDrop', () => {
  const dropOf = (...names: string[]) => ({
    preventDefault: vi.fn(),
    dataTransfer: { files: names.map((n) => new File([], n)) },
  })
  it('stops the browser opening a dropped file that is not an STL, and does nothing else', () => {
    const choose = vi.fn()
    const event = dropOf('a.png')
    handleStlDrop(event as never, choose)
    expect(event.preventDefault).toHaveBeenCalled()
    expect(choose).not.toHaveBeenCalled()
  })
  it('chooses the dropped STL', () => {
    const choose = vi.fn()
    const event = dropOf('a.png', 'b.stl')
    handleStlDrop(event as never, choose)
    expect(event.preventDefault).toHaveBeenCalled()
    expect(choose).toHaveBeenCalledWith(event.dataTransfer.files[1])
  })
})
