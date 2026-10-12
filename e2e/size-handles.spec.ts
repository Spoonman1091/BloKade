import { expect, test, type Page } from '@playwright/test'

type Spots = Record<string, readonly [number, number]>

const canvas = (page: Page) => page.locator('.viewport canvas').first()
const value = async (page: Page, testId: string): Promise<number> => Number(await page.getByTestId(testId).inputValue())

async function pagePoint(page: Page, id: string): Promise<{ x: number; y: number }> {
  await expect(canvas(page)).toHaveAttribute('data-size-handles', /"x\+"/)
  const spots = JSON.parse((await canvas(page).getAttribute('data-size-handles')) ?? '{}') as Spots
  const spot = spots[id]
  const box = await canvas(page).boundingBox()
  if (!spot || !box) throw new Error(`No handle ${id}`)
  return { x: box.x + spot[0], y: box.y + spot[1] }
}

async function boxWithHandles(page: Page): Promise<void> {
  await page.goto('/')
  await expect(page.getByText('Warming up the geometry engine…')).toBeHidden()
  await page.getByTestId('add-box').click()
  await expect(page.getByTestId('param-width')).toHaveValue('20')
  await page.getByTestId('tool-size').click()
}

/** Presses on the +x handle and drags it outward by the on-screen gap between the two x handles. */
async function dragWider(page: Page, finish: (page: Page) => Promise<void>): Promise<void> {
  const left = await pagePoint(page, 'x-')
  const right = await pagePoint(page, 'x+')
  await page.mouse.move(right.x, right.y)
  await page.mouse.down()
  await page.mouse.move(right.x + (right.x - left.x), right.y + (right.y - left.y), { steps: 8 })
  await finish(page)
}

test('dragging a side handle grows that side only, and one undo puts it back', async ({ page }) => {
  await boxWithHandles(page)
  await dragWider(page, async (p) => {
    await expect(p.getByTestId('measurement')).toContainText('Width')
    await p.mouse.up()
  })
  const width = await value(page, 'param-width')
  expect(width).toBeGreaterThan(30)
  expect((await value(page, 'pos-x')) - width / 2).toBeCloseTo(-10, 1)
  await expect(page.getByTestId('measurement')).toBeHidden()
  await page.getByTestId('undo').click()
  await expect(page.getByTestId('param-width')).toHaveValue('20')
  await expect(page.getByTestId('pos-x')).toHaveValue('0')
})

test('Esc during a drag puts the part back and keeps it selected', async ({ page }) => {
  await boxWithHandles(page)
  await dragWider(page, async (p) => {
    await p.keyboard.press('Escape')
    await p.mouse.up()
  })
  await expect(page.getByTestId('param-width')).toHaveValue('20')
  await expect(page.getByTestId('measurement')).toBeHidden()
})

test('keys pressed during a drag do not change the design', async ({ page }) => {
  await boxWithHandles(page)
  await dragWider(page, async (p) => {
    await p.keyboard.press('Delete')
    await p.keyboard.press('m')
    await p.mouse.up()
  })
  await expect(page.getByTestId('param-width')).toBeVisible()
  await expect.poll(() => value(page, 'param-width')).toBeGreaterThan(30)
  await expect(page.getByTestId('tool-size')).toHaveAttribute('aria-pressed', 'true')
})

test('letting go outside the 3D view still finishes the drag', async ({ page }) => {
  await boxWithHandles(page)
  await dragWider(page, async (p) => {
    const view = await canvas(p).boundingBox()
    if (!view) throw new Error('no 3D view')
    // Keep going right, past the edge of the 3D view into the properties panel, then let go there.
    await p.mouse.move(view.x + view.width + 20, (await pagePoint(p, 'x+')).y, { steps: 4 })
    await p.mouse.up()
  })
  await expect(page.getByTestId('measurement')).toBeHidden()
  await expect.poll(() => value(page, 'param-width')).toBeGreaterThan(30)
})

test('a handle shows a tip, and in help mode it explains itself without dragging', async ({ page }) => {
  await boxWithHandles(page)
  const right = await pagePoint(page, 'x+')
  await page.mouse.move(right.x, right.y)
  await page.mouse.move(right.x + 1, right.y)
  await expect(page.getByTestId('size-handle-tip')).toHaveText('Drag to change the Width.')

  await page.getByTestId('help-mode').click()
  await page.mouse.move(right.x, right.y)
  await page.mouse.down()
  await page.mouse.move(right.x + 80, right.y, { steps: 5 })
  await page.mouse.up()
  await expect(page.getByTestId('param-width')).toHaveValue('20')

  await page.mouse.move(right.x, right.y)
  await page.mouse.move(right.x + 1, right.y)
  await page.mouse.click(right.x + 1, right.y)
  await expect(page.getByTestId('help-card')).toContainText('The other side stays put')
  await page.keyboard.press('Escape')
})
