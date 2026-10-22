import { expect, test, type Page } from '@playwright/test'

const CUBE = 'e2e/fixtures/cube-20.stl'
const NOT_A_MODEL = 'e2e/fixtures/not-a-model.stl'

type Spots = Record<string, readonly [number, number]>

const canvas = (page: Page) => page.locator('.viewport canvas').first()
const value = async (page: Page, testId: string): Promise<number> => Number(await page.getByTestId(testId).inputValue())

async function start(page: Page): Promise<void> {
  await page.goto('/')
  await expect(page.getByText('Warming up the geometry engine…')).toBeHidden()
}

async function importCube(page: Page): Promise<void> {
  await page.getByTestId('import-stl').setInputFiles(CUBE)
  await expect(page.getByTestId('import-size')).toHaveText('20 × 20 × 20 mm')
  await page.getByTestId('import-confirm').click()
  await expect(page.getByTestId('import-dialog')).toBeHidden()
  await expect(page.getByTestId('param-width')).toHaveValue('20')
}

async function pagePoint(page: Page, id: string): Promise<{ x: number; y: number }> {
  await expect(canvas(page)).toHaveAttribute('data-size-handles', /"x\+"/)
  const spots = JSON.parse((await canvas(page).getAttribute('data-size-handles')) ?? '{}') as Spots
  const spot = spots[id]
  const box = await canvas(page).boundingBox()
  if (!spot || !box) throw new Error(`No handle ${id}`)
  return { x: box.x + spot[0], y: box.y + spot[1] }
}

const problems = (page: Page) => page.locator('[aria-label^="Problem:"]')

test('an imported model can be sized, cut with a hole, and undone', async ({ page }) => {
  await start(page)
  await importCube(page)
  await expect(page.getByTestId('prop-name')).toHaveValue('cube-20')

  await page.getByTestId('tool-size').click()
  const left = await pagePoint(page, 'x-')
  const right = await pagePoint(page, 'x+')
  await page.mouse.move(right.x, right.y)
  await page.mouse.down()
  await page.mouse.move(right.x + (right.x - left.x), right.y + (right.y - left.y), { steps: 8 })
  await page.mouse.up()
  await expect.poll(() => value(page, 'param-width')).toBeGreaterThan(30)

  await page.getByTestId('add-cylinder').click()
  await page.getByTestId('mode-hole').click()
  await page.getByRole('treeitem', { name: 'cube-20' }).click({ modifiers: ['Shift'] })
  await page.getByTestId('group').click()
  await expect(page.getByRole('treeitem', { name: 'Group' })).toBeVisible()
  await expect(problems(page)).toHaveCount(0)

  // Undo the group, the hole, the cylinder and the resize: back to the import.
  for (let i = 0; i < 4; i++) await page.getByTestId('undo').click()
  await page.getByRole('treeitem', { name: 'cube-20' }).click()
  await expect(page.getByTestId('param-width')).toHaveValue('20')
})

test('a file that is not a model says so and adds nothing', async ({ page }) => {
  await start(page)
  await page.getByTestId('import-stl').setInputFiles(NOT_A_MODEL)
  await expect(page.getByRole('status').filter({ hasText: "BloKade couldn't read this file. Is it an STL?" })).toBeVisible()
  await expect(page.getByTestId('import-dialog')).toBeHidden()
  await expect(page.getByRole('treeitem')).toHaveCount(0)
})

test('an imported model survives saving to a file and loading it again', async ({ page, browser }) => {
  await start(page)
  await importCube(page)
  await page.getByTestId('open-designs').click()
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Save to file' }).click()
  const saved = await (await download).path()

  const fresh = await browser.newContext()
  const other = await fresh.newPage()
  await start(other)
  await expect(other.getByRole('treeitem')).toHaveCount(0)
  await other.getByTestId('open-designs').click()
  await other.getByTestId('load-file').setInputFiles(saved)
  await expect(other.getByRole('button', { name: 'Save to file' })).toBeHidden()
  await other.getByRole('treeitem', { name: 'cube-20' }).click()
  await expect(other.getByTestId('param-width')).toHaveValue('20')
  await expect(problems(other)).toHaveCount(0)
  await fresh.close()
})
