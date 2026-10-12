// @vitest-environment jsdom
import { fireEvent, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { renderWithStore } from '../app/testing/render'
import { createEmptyDocument } from '../document/factory'
import { serializeDesign } from '../persistence/design-file'
import { createMemoryDesignRepository } from '../persistence/memory-repository'
import { createBloKadeStore } from '../store/store'
import { DesignsDialog } from './DesignsDialog'

async function setup(confirm = () => true) {
  let t = 0
  const repo = createMemoryDesignRepository({ now: () => ++t })
  await repo.save('other', createEmptyDocument('Other'))
  await repo.save('current', createEmptyDocument('Current'))
  const store = createBloKadeStore({ designId: 'current', doc: createEmptyDocument('Current') })
  const onClose = vi.fn()
  renderWithStore(<DesignsDialog repo={repo} flushAutosave={async () => undefined} onClose={onClose} confirm={confirm} />, store)
  await screen.findByText('Other')
  return { repo, store, onClose }
}

describe('DesignsDialog', () => {
  it('opens another design', async () => {
    const { store, onClose } = await setup()
    await userEvent.click(screen.getByRole('button', { name: 'Open' }))
    await waitFor(() => expect(store.getState().designId).toBe('other'))
    expect(store.getState().history.present.name).toBe('Other')
    expect(onClose).toHaveBeenCalled()
  })

  it('starts a new design', async () => {
    const { store, repo } = await setup()
    await userEvent.click(screen.getByRole('button', { name: 'New design' }))
    await waitFor(() => expect(store.getState().designId).not.toBe('current'))
    expect(await repo.list()).toHaveLength(3)
  })

  it('renames the current design', async () => {
    const { store } = await setup()
    const input = screen.getByTestId('design-name')
    await userEvent.clear(input)
    await userEvent.type(input, 'Rocket{Enter}')
    expect(store.getState().history.present.name).toBe('Rocket')
  })

  it('deletes another design after confirming', async () => {
    const confirm = vi.fn(() => true)
    const { repo } = await setup(confirm)
    await userEvent.click(screen.getByRole('button', { name: 'Delete Other' }))
    await waitFor(async () => expect((await repo.list()).map((d) => d.id)).toEqual(['current']))
    expect(confirm).toHaveBeenCalledWith('Delete "Other"? This can\'t be undone.')
  })

  it('keeps a design when deletion is not confirmed', async () => {
    const { repo } = await setup(() => false)
    await userEvent.click(screen.getByRole('button', { name: 'Delete Other' }))
    expect(await repo.list()).toHaveLength(2)
  })

  it('duplicates a design', async () => {
    await setup()
    await userEvent.click(screen.getByRole('button', { name: 'Duplicate Other' }))
    expect(await screen.findByText('Other copy')).toBeInTheDocument()
  })

  it('loads a design file', async () => {
    const { store } = await setup()
    const file = new File([serializeDesign(createEmptyDocument('From File'))], 'from-file.blokade')
    fireEvent.change(screen.getByTestId('load-file'), { target: { files: [file] } })
    await waitFor(() => expect(store.getState().history.present.name).toBe('From File'))
  })

  it('explains a bad file', async () => {
    const { store } = await setup()
    const file = new File(['nope'], 'bad.blokade')
    fireEvent.change(screen.getByTestId('load-file'), { target: { files: [file] } })
    await waitFor(() => expect(store.getState().notice).toBe("This file isn't a BloKade design."))
    expect(store.getState().designId).toBe('current')
  })
})
