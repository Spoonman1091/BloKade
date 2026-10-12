import { readFile } from 'node:fs/promises'
import { expect, test, type Page } from '@playwright/test'

async function setField(page: Page, testId: string, value: string) {
  await page.getByTestId(testId).fill(value)
  await page.getByTestId(testId).press('Enter')
}

async function downloadBytes(page: Page, testId: string): Promise<Buffer> {
  const downloading = page.waitForEvent('download')
  await page.getByTestId(testId).click()
  return readFile(await (await downloading).path())
}

/** Smallest and largest X over every vertex of a binary STL. */
function stlXRange(bytes: Buffer): [number, number] {
  const triangles = bytes.readUInt32LE(80)
  const xs = Array.from({ length: triangles * 3 }, (_, i) => {
    const triangle = Math.floor(i / 3)
    return bytes.readFloatLE(84 + triangle * 50 + 12 + (i % 3) * 12)
  })
  return [Math.min(...xs), Math.max(...xs)]
}

test('box with a hole, grouped, top edges rounded, exported (spec §8 flow)', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('add-box').click()
  await setField(page, 'param-width', '30')
  await page.getByTestId('add-cylinder').click()
  await setField(page, 'param-diameter', '10')
  await page.getByTestId('mode-hole').click()
  await page.getByRole('treeitem', { name: 'Box' }).click()
  await page.getByRole('treeitem', { name: 'Cylinder' }).click({ modifiers: ['Shift'] })
  await page.getByTestId('group').click()
  await page.getByRole('treeitem', { name: 'Group' }).click()

  await page.getByTestId('add-modifier').selectOption('fillet')
  await setField(page, 'mod-radius-0', '1')
  await expect(page.getByText('Warming up the geometry engine…')).toBeHidden()
  await expect(page.getByTestId('mod-warning-0')).toHaveCount(0)

  const bytes = await downloadBytes(page, 'export-stl')
  const triangles = bytes.readUInt32LE(80)
  expect(triangles).toBeGreaterThan(200)
  expect(bytes.length).toBe(84 + triangles * 50)
})

test('repeat a box in a row of three', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('add-box').click()
  await page.getByTestId('add-modifier').selectOption('linearPattern')
  await setField(page, 'mod-count-0', '3')
  await setField(page, 'mod-spacing-x-0', '25')
  await expect(page.getByText('Warming up the geometry engine…')).toBeHidden()

  await expect(async () => {
    const [x0, x1] = stlXRange(await downloadBytes(page, 'export-stl'))
    expect(x0).toBeCloseTo(-10, 1)
    expect(x1).toBeCloseTo(60, 1)
  }).toPass({ timeout: 20_000 })
})

test('export STEP for other CAD programs', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('add-box').click()
  await expect(page.getByText('Warming up the geometry engine…')).toBeHidden()
  const bytes = await downloadBytes(page, 'export-step')
  expect(bytes.subarray(0, 12).toString('ascii')).toBe('ISO-10303-21')
})

test('modifiers survive a reload', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('add-box').click()
  await page.getByTestId('add-modifier').selectOption('chamfer')
  await page.getByTestId('mod-edges-0').selectOption('bottom')
  await page.waitForTimeout(1500) // autosave runs 1 s after the last change
  await page.reload()
  await page.getByRole('treeitem', { name: 'Box' }).click()
  await expect(page.getByTestId('modifier-0')).toContainText('Bevel edges')
  await expect(page.getByTestId('mod-edges-0')).toHaveValue('bottom')
})
