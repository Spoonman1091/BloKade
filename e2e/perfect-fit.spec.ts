import { readFile } from 'node:fs/promises'
import { expect, test, type Page } from '@playwright/test'

async function setField(page: Page, testId: string, value: string) {
  await page.getByTestId(testId).fill(value)
  await page.getByTestId(testId).press('Enter')
}

async function ready(page: Page) {
  await page.goto('/')
  await expect(page.getByText('Warming up the geometry engine…')).toBeHidden()
}

async function exportStl(page: Page): Promise<Buffer> {
  const downloading = page.waitForEvent('download')
  await page.getByTestId('export-stl').click()
  return readFile(await (await downloading).path())
}

/** Exports until the bytes differ from `before` (the rebuild after an edit is asynchronous). */
async function exportChangedFrom(page: Page, before: Buffer): Promise<Buffer> {
  let latest: Buffer = before
  await expect(async () => {
    latest = await exportStl(page)
    expect(latest.equals(before)).toBe(false)
  }).toPass({ timeout: 30_000 })
  return latest
}

test('peg & socket stay matched when the fit gap changes', async ({ page }) => {
  await ready(page)
  await page.getByTestId('add-kit-peg-socket').click()
  await expect(page.getByRole('treeitem', { name: 'Peg' })).toBeVisible()
  await page.getByRole('treeitem', { name: 'Socket' }).click()
  await expect(page.getByTestId('param-clearance')).toHaveValue('fit')
  await expect(page.getByTestId('param-clearance-value')).toHaveText('= 0.2')

  await page.getByTestId('add-box').click()
  await setField(page, 'pos-x', '25') // the kit puts the Socket at x = 25
  await page.getByRole('treeitem', { name: 'Box' }).click()
  await page.getByRole('treeitem', { name: 'Socket' }).click({ modifiers: ['Shift'] })
  await page.getByTestId('group').click()
  let before: Buffer = Buffer.alloc(0)
  await expect(async () => {
    before = await exportStl(page)
    expect(before.readUInt32LE(80)).toBeGreaterThan(100)
  }).toPass({ timeout: 30_000 })

  await setField(page, 'fit', '0.4')
  await exportChangedFrom(page, before)
  await expect(page.getByLabel(/^Problem/)).toHaveCount(0)
})

test('a countersunk screw hole cuts into a box and exports', async ({ page }) => {
  await ready(page)
  await page.getByTestId('add-box').click()
  await page.getByTestId('add-screw-hole').click()
  await page.getByRole('treeitem', { name: 'Box' }).click()
  await page.getByRole('treeitem', { name: 'Screw hole' }).click({ modifiers: ['Shift'] })
  await page.getByTestId('group').click()
  let plain: Buffer = Buffer.alloc(0)
  await expect(async () => {
    plain = await exportStl(page)
    expect(plain.readUInt32LE(80)).toBeGreaterThan(100)
  }).toPass({ timeout: 30_000 })

  await page.getByRole('treeitem', { name: 'Screw hole' }).click()
  await page.getByTestId('param-style').selectOption('countersunk')
  const countersunk = await exportChangedFrom(page, plain)
  expect(countersunk.readUInt32LE(80)).not.toBe(plain.readUInt32LE(80))
  await expect(page.getByLabel(/^Problem/)).toHaveCount(0)
})

test('a threaded rod builds', async ({ page }) => {
  await ready(page)
  await page.getByTestId('add-threaded-rod').click()
  await expect(async () => {
    const downloading = page.waitForEvent('download')
    await page.getByTestId('export-stl').click()
    const bytes = await readFile(await (await downloading).path())
    expect(bytes.readUInt32LE(80)).toBeGreaterThan(1000)
  }).toPass({ timeout: 30_000 })
})

test('overlap check finds where two boxes collide', async ({ page }) => {
  await ready(page)
  await page.getByTestId('add-box').click()
  await page.getByTestId('add-box').click()
  await setField(page, 'pos-x', '10')
  await page.getByRole('treeitem', { name: 'Box' }).first().click()
  await page.getByRole('treeitem', { name: 'Box' }).last().click({ modifiers: ['Shift'] })
  await page.getByTestId('check-overlap').click()
  await expect(page.getByTestId('overlap-result')).toHaveText('These overlap by 4000 mm³ (shown in red).', { timeout: 20_000 })
})
