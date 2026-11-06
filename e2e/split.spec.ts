import { readFile } from 'node:fs/promises'
import { expect, test } from '@playwright/test'
import { unzipSync } from 'fflate'

test('splits a chest plate into four pieces', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('Warming up the geometry engine…')).toBeHidden()
  await page.getByTestId('split-for-printing').click()

  await page.getByTestId('split-open').setInputFiles('e2e/fixtures/chest-plate.stl')
  await expect(page.getByTestId('split-plan')).toHaveText('4 pieces (2 × 2)')

  await page.getByTestId('split-make').click()
  await expect(page.getByTestId('split-save')).toBeEnabled({ timeout: 60_000 })
  const map = page.getByTestId('split-map')
  for (const n of ['1', '2', '3', '4']) await expect(map.locator('text', { hasText: new RegExp(`^${n}$`) })).toHaveCount(1)
  await expect(map.locator('text', { hasText: /^5$/ })).toHaveCount(0)

  const download = page.waitForEvent('download')
  await page.getByTestId('split-save').click()
  const path = await (await download).path()
  const files = unzipSync(new Uint8Array(await readFile(path)))
  const stls = Object.entries(files).filter(([name]) => name.endsWith('.stl'))
  expect(stls).toHaveLength(4)
  // An empty binary STL is 84 bytes (header and count): each piece must hold triangles.
  for (const [name, bytes] of stls) expect(bytes.length, name).toBeGreaterThan(84)

  await page.getByTestId('split-back').click()
  await expect(page.getByTestId('split-for-printing')).toBeVisible()
  await expect(page.getByTestId('split-view')).toBeHidden()
})
