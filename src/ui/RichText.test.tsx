// @vitest-environment jsdom
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { RichText } from './RichText'

describe('RichText', () => {
  it('makes **text** bold and leaves the rest alone', () => {
    const { container } = render(<p><RichText text="Click **Box**, then **Width**." /></p>)
    expect(container.querySelectorAll('strong')).toHaveLength(2)
    expect(container.textContent).toBe('Click Box, then Width.')
  })
})
