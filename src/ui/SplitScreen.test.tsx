// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { downloadBytes } from '../app/download'
import { fakeDeps } from '../app/testing/fakes'
import { renderMainScreen, sampleStores } from '../app/testing/main-screen'
import { printerStore } from '../printers/printer-store'
import { DEFAULT_PRINTER, NO_PRINTER } from '../printers/printers'
import { helpFor, helpKeyOf } from '../help/lookup'
import { NO_BASE_MESSAGE, NO_PRINTER_MESSAGE, THIN_TONGUE_MESSAGE } from '../split/constants'
import { createSplitClient } from '../split/split-client'
import { SplitScreen } from './SplitScreen'
import { fakeSplitClient, piece, FOUR, type FakeOptions } from './split/testing/fake-split-client'

vi.mock('../viewport/Viewport', () => ({ Viewport: () => null }))
vi.mock('./split/SplitView', () => ({ SplitView: () => null }))
vi.mock('../app/download', () => ({ downloadBytes: vi.fn() }))
vi.mock('../split/split-client', async (original) => ({ ...(await original<typeof import('../split/split-client')>()), createSplitClient: vi.fn() }))

afterEach(() => {
  cleanup()
  printerStore.getState().setPrinter(DEFAULT_PRINTER)
  vi.clearAllMocks()
})

const stl = (name = 'Chest Plate.stl') => new File([new Uint8Array([1, 2, 3, 4])], name, { type: 'model/stl' })

function setup(options: FakeOptions = {}) {
  const fake = fakeSplitClient(options)
  const onBack = vi.fn()
  render(<SplitScreen createClient={() => fake.client} helpMode={false} onHelpMode={vi.fn()} onBack={onBack} />)
  return { ...fake, onBack }
}

const openFile = async (name?: string) => {
  await userEvent.upload(screen.getByTestId('split-open'), stl(name))
  await screen.findByTestId('split-summary')
}

describe('SplitScreen: opening and planning', () => {
  it('shows the size and triangle count, then the plan and the cut sliders', async () => {
    setup()
    await openFile()
    expect(screen.getByTestId('split-size')).toHaveTextContent('254 × 305 × 12 mm, 812,000 triangles')
    expect(await screen.findByText('4 pieces (2 × 2)')).toBeInTheDocument()
    const first = screen.getByTestId('split-cut-0')
    expect([first.getAttribute('min'), first.getAttribute('max')]).toEqual(['-33', '33'])
    const second = screen.getByTestId('split-cut-1')
    expect([second.getAttribute('min'), second.getAttribute('max'), (second as HTMLInputElement).value]).toEqual(['-7.5', '7.5', '2'])
    expect(screen.getByTestId('split-base')).toHaveValue('6.4')
  })

  it('slides cuts smoothly and says where each one is in mm', async () => {
    setup()
    await openFile()
    await screen.findByText('4 pieces (2 × 2)')
    const first = screen.getByTestId('split-cut-0')
    expect(first.getAttribute('step')).toBe('any')
    expect(screen.getByText(/Cut 1: slide left or right/)).toHaveTextContent('127 mm from the left')
    expect(screen.getByText(/Cut 2: slide front or back/)).toHaveTextContent('154.5 mm from the front')
    fireEvent.change(first, { target: { value: '12.25' } })
    expect(screen.getByText(/Cut 1: slide left or right/)).toHaveTextContent('139.3 mm from the left')
  })

  it('opens with the chosen unit and opens the kept file again when the unit changes', async () => {
    const { client } = setup()
    await userEvent.selectOptions(screen.getByTestId('split-units'), 'inches')
    await openFile()
    expect(client.open).toHaveBeenLastCalledWith(expect.any(ArrayBuffer), 'inches')
    await userEvent.selectOptions(screen.getByTestId('split-units'), 'cm')
    await waitFor(() => expect(client.open).toHaveBeenCalledTimes(2))
    expect(client.open).toHaveBeenLastCalledWith(expect.any(ArrayBuffer), 'cm')
  })

  it('shows the worker message when the file cannot be opened', async () => {
    const { client } = setup()
    client.open.mockResolvedValueOnce({ ok: false, message: 'This model has gaps.' })
    await userEvent.upload(screen.getByTestId('split-open'), stl())
    expect(await screen.findByTestId('split-message')).toHaveTextContent('This model has gaps.')
    expect(screen.queryByTestId('split-summary')).toBeNull()
  })

  it('plans again when the joint style changes, but not for the fit gap', async () => {
    const { client } = setup()
    await openFile()
    await screen.findByText('4 pieces (2 × 2)')
    const before = client.plan.mock.calls.length
    await userEvent.selectOptions(screen.getByTestId('split-joint'), 'none')
    await waitFor(() => expect(client.plan.mock.calls.length).toBe(before + 1))
    const gap = screen.getByTestId('split-fit-gap')
    await userEvent.clear(gap)
    await userEvent.type(gap, '0.4{Enter}')
    expect(client.plan.mock.calls.length).toBe(before + 1)
  })
})

describe('SplitScreen: making and saving pieces', () => {
  it('makes pieces with progress, then shows the map and saves a ZIP', async () => {
    const { client } = setup()
    await openFile()
    await userEvent.click(await screen.findByTestId('split-make'))
    expect(client.pieces).toHaveBeenCalledTimes(1)
    const map = await screen.findByTestId('split-map')
    for (const n of ['1', '2', '3', '4']) expect(within(map).getByText(n)).toBeInTheDocument()
    expect(screen.queryByTestId('split-progress')).toBeNull()
    await userEvent.click(screen.getByTestId('split-save'))
    await waitFor(() => expect(downloadBytes).toHaveBeenCalledWith(expect.any(Uint8Array), 'chest-plate-pieces.zip', 'application/zip'))
    expect(client.save).toHaveBeenCalledWith('chest-plate')
  })

  it('shows progress while the pieces are being made', async () => {
    const { client } = setup({ hangPieces: true })
    await openFile()
    await userEvent.click(await screen.findByTestId('split-make'))
    expect(await screen.findByTestId('split-progress')).toHaveTextContent('Cutting piece 2 of 4…')
    client.cancel()
  })

  it('cancels making pieces, stays usable and can make them again (Review Focus 5)', async () => {
    const { client, settings } = setup({ hangPieces: true })
    await openFile()
    await userEvent.click(await screen.findByTestId('split-make'))
    await screen.findByTestId('split-progress')
    await userEvent.click(screen.getByTestId('split-cancel'))
    expect(client.cancel).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(screen.queryByTestId('split-progress')).toBeNull())
    expect(screen.queryByTestId('split-message')).toBeNull()
    expect(screen.getByTestId('split-make')).toBeEnabled()
    settings.hangPieces = false
    await userEvent.click(screen.getByTestId('split-make'))
    expect(await screen.findByTestId('split-map')).toBeInTheDocument()
  })

  it('opening a second file resets the pieces', async () => {
    setup()
    await openFile()
    await userEvent.click(await screen.findByTestId('split-make'))
    await screen.findByTestId('split-map')
    await userEvent.upload(screen.getByTestId('split-open'), stl('Other.stl'))
    await waitFor(() => expect(screen.queryByTestId('split-map')).toBeNull())
    await screen.findByText('4 pieces (2 × 2)')
    expect(screen.getByTestId('split-save')).toBeDisabled()
  })

  it('drops the pieces when a cut moves or a setting changes', async () => {
    const { client } = setup()
    await openFile()
    await userEvent.click(await screen.findByTestId('split-make'))
    await screen.findByTestId('split-map')
    fireEvent.change(screen.getByTestId('split-cut-0'), { target: { value: '20' } })
    expect(screen.queryByTestId('split-map')).toBeNull()
    expect(screen.getByTestId('split-save')).toBeDisabled()
    await userEvent.click(screen.getByTestId('split-make'))
    await screen.findByTestId('split-map')
    expect(client.pieces.mock.calls[1]?.[0].cuts[0]?.at).toBe(20)
    await userEvent.click(screen.getByTestId('split-numbers'))
    expect(screen.queryByTestId('split-map')).toBeNull()
  })

  it('says which pieces do not fit and disables Save', async () => {
    setup({ pieces: { pieces: [piece(1), piece(2), piece(3, false), piece(4)], glueCuts: [], glueSegments: [] } })
    await openFile()
    await userEvent.click(await screen.findByTestId('split-make'))
    await screen.findByTestId('split-map')
    expect(screen.getByTestId('split-message')).toHaveTextContent('Piece 3 is too big for your printer. Move the cuts or pick a bigger printer.')
    expect(screen.getByTestId('split-save')).toBeDisabled()
  })

  it('marks glue cuts on the map', async () => {
    setup({ pieces: { ...FOUR, glueCuts: [1], glueSegments: [{ cut: 1, from: -127, to: 0 }] } })
    await openFile()
    await userEvent.click(await screen.findByTestId('split-make'))
    expect(within(await screen.findByTestId('split-map')).getByText('glue here')).toBeInTheDocument()
  })
})

describe('SplitScreen: messages and limits', () => {
  it('asks for a printer and disables Make when there is none', async () => {
    printerStore.getState().setPrinter(NO_PRINTER)
    const { client } = setup()
    await openFile()
    expect(await screen.findByTestId('split-message')).toHaveTextContent(NO_PRINTER_MESSAGE)
    expect(screen.getByTestId('split-make')).toBeDisabled()
    expect(client.plan).not.toHaveBeenCalled()
  })

  it('greys out Tongue under 4 mm of base and says why', async () => {
    setup({ base: 3 })
    await openFile()
    await screen.findByText('4 pieces (2 × 2)')
    expect(screen.getByRole('option', { name: /Tongue/ })).toBeDisabled()
    expect(screen.getByTestId('split-message')).toHaveTextContent(THIN_TONGUE_MESSAGE)
  })

  it('switches from Tongue to tabs when the base is made thin', async () => {
    setup()
    await openFile()
    await screen.findByText('4 pieces (2 × 2)')
    await userEvent.selectOptions(screen.getByTestId('split-joint'), 'tongue')
    const base = screen.getByTestId('split-base')
    await userEvent.clear(base)
    await userEvent.type(base, '3{Enter}')
    expect(screen.getByTestId('split-joint')).toHaveValue('tabs')
  })

  it('has no joints and says so when the model has no flat base', async () => {
    const { client } = setup({ base: null })
    await openFile()
    expect(await screen.findByTestId('split-message')).toHaveTextContent(NO_BASE_MESSAGE)
    expect(screen.getByTestId('split-joint')).toBeDisabled()
    expect(screen.getByTestId('split-base')).toBeDisabled()
    await userEvent.click(screen.getByTestId('split-make'))
    await screen.findByTestId('split-map')
    expect(client.pieces.mock.calls[0]?.[1]).toMatchObject({ joint: 'none', baseThickness: null })
  })

  it('has help for every control and test id', async () => {
    setup({ hangPieces: true })
    await openFile()
    await userEvent.click(await screen.findByTestId('split-make'))
    await screen.findByTestId('split-progress')
    const missing = [...document.querySelectorAll('button, input, select, [data-testid]')].flatMap((el) => {
      const found = helpKeyOf(el)
      return found && helpFor(found.key, found.label) ? [] : [el.outerHTML.slice(0, 100)]
    })
    expect(missing).toEqual([])
  })
})

describe('SplitScreen: leaving', () => {
  it('goes back when Back is pressed and disposes its client when it closes', async () => {
    const { client, onBack } = setup()
    await userEvent.click(screen.getByTestId('split-back'))
    expect(onBack).toHaveBeenCalled()
    cleanup()
    expect(client.dispose).toHaveBeenCalled()
  })
})

describe('Split for printing in the app', () => {
  it('opens from the toolbar and Back returns to the design untouched', async () => {
    const fake = fakeSplitClient()
    vi.mocked(createSplitClient).mockReturnValue(fake.client)
    const store = sampleStores()[0]!
    renderMainScreen(store, undefined, fakeDeps())
    const before = store.getState().history.present
    await userEvent.click(screen.getByTestId('split-for-printing'))
    expect(await screen.findByTestId('split-open')).toBeInTheDocument()
    expect(screen.queryByTestId('viewport')).toBeNull()
    await userEvent.click(screen.getByTestId('split-back'))
    expect(await screen.findByTestId('viewport')).toBeInTheDocument()
    expect(store.getState().history.present).toBe(before)
    expect(fake.client.dispose).toHaveBeenCalled()
  })
})
