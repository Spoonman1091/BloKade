import { readFile } from 'node:fs/promises'
import { expect, test } from '@playwright/test'

test('a variable drives a size, and changing it resizes the part', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('add-box').click()
  await page.getByTestId('add-variable').click()
  await page.getByTestId('var-name-var1').fill('wall')
  await page.getByTestId('var-name-var1').press('Enter')
  await page.getByTestId('var-expr-wall').fill('3')
  await page.getByTestId('var-expr-wall').press('Enter')

  await page.getByRole('treeitem', { name: 'Box' }).click()
  await page.getByTestId('param-width').fill('wall * 10')
  await page.getByTestId('param-width').press('Enter')
  await expect(page.getByTestId('param-width-value')).toHaveText('= 30')

  await page.getByTestId('var-expr-wall').fill('4')
  await page.getByTestId('var-expr-wall').press('Enter')
  await expect(page.getByTestId('param-width-value')).toHaveText('= 40')

  await page.waitForTimeout(1500) // autosave runs 1 s after the last change
  await page.reload()
  await page.getByRole('treeitem', { name: 'Box' }).click()
  await expect(page.getByTestId('param-width')).toHaveValue('wall * 10')
})

test('Kade adds his name in 3D letters and exports them', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('add-text').click()
  await expect(page.getByText('Warming up the geometry engine…')).toBeHidden()

  const downloading = page.waitForEvent('download')
  await page.getByTestId('export-stl').click()
  const bytes = await readFile(await (await downloading).path())
  const triangles = bytes.readUInt32LE(80)
  expect(triangles).toBeGreaterThan(100)
  expect(bytes.length).toBe(84 + triangles * 50)
})

test('line up two parts by their left edges', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('add-box').click()
  await page.getByTestId('add-cylinder').click()
  await page.getByTestId('pos-x').fill('30')
  await page.getByTestId('pos-x').press('Enter')
  await expect(page.getByText('Warming up the geometry engine…')).toBeHidden()

  // Meshes arrive asynchronously, so retry until both parts can be lined up.
  await expect(async () => {
    await page.getByRole('treeitem', { name: 'Box' }).click()
    await page.getByRole('treeitem', { name: 'Cylinder' }).click({ modifiers: ['Shift'] })
    await page.getByTestId('align-x-min').click()
    await page.getByRole('treeitem', { name: 'Cylinder' }).click()
    await expect(page.getByTestId('pos-x')).toHaveValue('0', { timeout: 1000 })
  }).toPass({ timeout: 20_000 })
})
