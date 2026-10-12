// @vitest-environment jsdom
import { act, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderWithStore } from '../app/testing/render'
import { createEmptyDocument } from '../document/factory'
import { createBloKadeStore } from '../store/store'
import { NOTICE_DURATION_MS, Toasts } from './Toasts'

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('Toasts', () => {
  it('keeps a sticky notice on screen with no dismiss button', () => {
    const store = createBloKadeStore({ designId: 'd', doc: createEmptyDocument() })
    renderWithStore(<Toasts />, store)
    act(() => store.getState().setStickyNotice('Reload please.'))
    act(() => vi.advanceTimersByTime(NOTICE_DURATION_MS * 2))
    expect(screen.getByRole('alert')).toHaveTextContent('Reload please.')
    expect(screen.queryByRole('button', { name: 'Dismiss message' })).toBeNull()
  })

  it('hides a normal notice after a while', () => {
    const store = createBloKadeStore({ designId: 'd', doc: createEmptyDocument() })
    renderWithStore(<Toasts />, store)
    act(() => store.getState().notify('Hello'))
    expect(screen.getByRole('status')).toHaveTextContent('Hello')
    act(() => vi.advanceTimersByTime(NOTICE_DURATION_MS))
    expect(screen.queryByRole('status')).toBeNull()
  })
})
