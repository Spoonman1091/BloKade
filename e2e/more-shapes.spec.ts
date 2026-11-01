import { readFile } from 'node:fs/promises'
import { expect, test, type Page } from '@playwright/test'

const IDS = ['roof', 'round-roof', 'tube', 'half-sphere', 'pyramid', 'polygon', 'paraboloid', 'star', 'heart', 'icosahedron']

async function ready(page: Page) {
  await page.goto('/')
  await expect(page.getByText('Warming up the geometry engine…')).toBeHidden()
}

async function exportStl(page: Page): Promise<Buffer> {
  const downloading = page.waitForEvent('download')
  await page.getByTestId('export-stl').click()
  return readFile(await (await downloading).path())
}

test('adds every new shape and exports it', async ({ page }) => {
  await ready(page)
  await page.getByTestId('more-shapes-toggle').click()
  for (const id of IDS) await page.getByTestId(`add-${id}`).click()
  await page.getByTestId('viewport').click({ position: { x: 5, y: 5 } }) // nothing selected, so everything exports
  await expect(async () => {
    const stl = await exportStl(page)
    expect(stl.readUInt32LE(80)).toBeGreaterThan(100)
  }).toPass({ timeout: 30_000 })
  await expect(page.getByLabel(/^Problem/)).toHaveCount(0)
})

test('starts closed with a New badge that goes away once opened', async ({ page }) => {
  await ready(page)
  await expect(page.getByTestId('add-roof')).toBeHidden()
  await expect(page.getByTestId('more-shapes-new')).toBeVisible()
  await page.getByTestId('more-shapes-toggle').click()
  await expect(page.getByTestId('add-roof')).toBeVisible()
  await expect(page.getByTestId('more-shapes-new')).toBeHidden()
})

test('keeps Fit tools on a laptop screen on a fresh visit', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 })
  await ready(page)
  const box = await page.getByTestId('add-kit-peg-socket').boundingBox()
  expect(box).not.toBeNull()
  expect(box!.y + box!.height).toBeLessThanOrEqual(768)
})

test('remembers when More shapes is opened or closed', async ({ page }) => {
  await ready(page)
  await page.getByTestId('more-shapes-toggle').click()
  await expect(page.getByTestId('add-roof')).toBeVisible()
  await ready(page)
  await expect(page.getByTestId('add-roof')).toBeVisible()
  await expect(page.getByTestId('more-shapes-new')).toBeHidden()
  await page.getByTestId('more-shapes-toggle').click()
  await expect(page.getByTestId('add-roof')).toBeHidden()
  await ready(page)
  await expect(page.getByTestId('add-roof')).toBeHidden()
  await expect(page.getByTestId('more-shapes-new')).toBeHidden()
})
