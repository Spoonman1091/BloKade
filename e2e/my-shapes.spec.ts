import { readFile } from 'node:fs/promises'
import { expect, test, type Page } from '@playwright/test'

const ROBOT = `export default {
  name: 'Robot head',
  icon: '🤖',
  settings: { size: { type: 'mm', default: 20, label: 'Size' } },
  build({ size }, cad) {
    return cad.box(size, size, size).cut(cad.cylinder(6, size + 2).move(0, 0, -1))
  },
}`

const numbersCode = (call: string) => `export default {
  name: 'Numbers practice',
  icon: '🔢',
  build(settings, cad) {
    return ${call}
  },
}`

async function openMyShapes(page: Page) {
  await page.goto('/')
  await expect(page.getByText('Warming up the geometry engine…')).toBeHidden()
  await page.getByTestId('my-shapes').click()
}

/** Replaces all the code. insertText avoids CodeMirror adding closing brackets as it would for typed keys. */
async function replaceCode(page: Page, code: string) {
  await page.getByTestId('code-input').click()
  await page.keyboard.press('ControlOrMeta+a')
  await page.keyboard.press('Delete')
  await page.keyboard.insertText(code)
}

async function writeRobot(page: Page) {
  await page.getByTestId('new-shape').click()
  await replaceCode(page, ROBOT)
  await expect(page.getByTestId('code-ok')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Robot head' })).toBeVisible()
}

async function exportStlTriangles(page: Page): Promise<number> {
  const downloading = page.waitForEvent('download')
  await page.getByTestId('export-stl').click()
  const bytes = await readFile(await (await downloading).path())
  return bytes.readUInt32LE(80)
}

test('Kade writes a shape, tries a setting, adds it to a design and exports it', async ({ page }) => {
  await openMyShapes(page)
  await writeRobot(page)
  await page.getByTestId('param-size').fill('30')
  await page.getByTestId('param-size').press('Enter')
  await expect(page.getByTestId('code-ok')).toBeVisible()
  await page.getByTestId('add-to-design').click()
  await expect(page.getByRole('treeitem', { name: 'Robot head' })).toBeVisible()
  await expect(page.locator('[data-testid^="add-my-"]')).toHaveCount(1)
  expect(await exportStlTriangles(page)).toBeGreaterThan(12)
})

test('a design file carrying a shape builds in a fresh browser profile', async ({ page, browser }) => {
  await openMyShapes(page)
  await writeRobot(page)
  await page.getByTestId('add-to-design').click()
  await expect(page.getByRole('treeitem', { name: 'Robot head' })).toBeVisible()
  await page.getByTestId('open-designs').click()
  const saving = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Save to file' }).click()
  const designFile = await (await saving).path()

  const fresh = await browser.newContext()
  const other = await fresh.newPage()
  await other.goto('/')
  await expect(other.getByText('Warming up the geometry engine…')).toBeHidden()
  await other.getByTestId('open-designs').click()
  await other.getByTestId('load-file').setInputFiles(designFile)
  await expect(other.getByRole('treeitem', { name: 'Robot head' })).toBeVisible()
  expect(await exportStlTriangles(other)).toBeGreaterThan(12)
  await fresh.close()
})

test('Kade finishes coding lesson 1', async ({ page }) => {
  await openMyShapes(page)
  await page.getByTestId('tab-lessons').click()
  await page.getByTestId('code-lesson-start-code-numbers').click()
  const step = page.getByTestId('lesson-step')
  await expect(step).toContainText('Change 20 to 40')
  await replaceCode(page, numbersCode('cad.box(40, 10, 5)'))
  await expect(step).toContainText('taller than 20')
  await replaceCode(page, numbersCode('cad.box(40, 10, 25)'))
  await expect(step).toContainText('cad.cylinder(20, 30)')
  await replaceCode(page, numbersCode('cad.cylinder(20, 30)'))
  await expect(page.getByTestId('lesson-finished')).toBeVisible()
})
