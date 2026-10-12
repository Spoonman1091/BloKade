import { readFile } from 'node:fs/promises'
import { expect, test } from '@playwright/test'

test('Kade builds a box with a hole, exports it, and finds it again after reloading', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('add-box').click()
  await page.getByTestId('param-width').fill('40')
  await page.getByTestId('param-width').press('Enter')

  await page.getByTestId('add-cylinder').click()
  await page.getByTestId('mode-hole').click()

  await page.getByRole('treeitem', { name: 'Box' }).click()
  await page.getByRole('treeitem', { name: 'Cylinder' }).click({ modifiers: ['Shift'] })
  await page.getByTestId('group').click()
  await expect(page.getByRole('treeitem', { name: 'Group' })).toBeVisible()
  await expect(page.getByText('Warming up the geometry engine…')).toBeHidden()

  const downloading = page.waitForEvent('download')
  await page.getByTestId('export-stl').click()
  const download = await downloading
  expect(download.suggestedFilename()).toBe('untitled-design.stl')
  const bytes = await readFile(await download.path())
  const triangles = bytes.readUInt32LE(80)
  expect(triangles).toBeGreaterThan(12)
  expect(bytes.length).toBe(84 + triangles * 50)

  await page.waitForTimeout(1500) // autosave runs 1 s after the last change
  await page.reload()
  await expect(page.getByRole('treeitem', { name: 'Group' })).toBeVisible()
})

test('a shape that cannot be built shows a friendly warning', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('add-torus').click()
  await page.getByTestId('param-thickness').fill('30')
  await page.getByTestId('param-thickness').press('Enter')
  await expect(page.getByRole('alert')).toContainText('Make the ring wider than twice its thickness.')
  await expect(page.getByRole('treeitem', { name: 'Ring' })).toBeVisible()
})
