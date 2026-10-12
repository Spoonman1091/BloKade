import { readFile, writeFile } from 'node:fs/promises'
import { expect, test, type Page } from '@playwright/test'

/** Builds fine at the default size, and never finishes when Size is over 50. */
const SPINNER = `export default {
  name: 'Spinner',
  icon: '🌀',
  settings: { size: { type: 'mm', default: 20, label: 'Size' } },
  build({ size }, cad) {
    while (size > 50) {}
    return cad.box(size, size, size)
  },
}`

const TOO_LONG = 'This shape took too long to build. Check for a loop that never ends.'
const STUCK_NOTICE = 'The geometry engine got stuck'
/** The worker restarts after 30 s, so a stuck build takes a little longer than that to show. */
const AFTER_RESTART = { timeout: 60_000 }

async function openApp(page: Page) {
  await page.goto('/')
  await expect(page.getByText('Warming up the geometry engine…')).toBeHidden()
}

/** Writes SPINNER in My shapes, adds it to the design, and adds a box next to it. */
async function designWithSpinner(page: Page) {
  await openApp(page)
  await page.getByTestId('my-shapes').click()
  await page.getByTestId('new-shape').click()
  await page.getByTestId('code-input').click()
  await page.keyboard.press('ControlOrMeta+a')
  await page.keyboard.press('Delete')
  await page.keyboard.insertText(SPINNER)
  await expect(page.getByTestId('code-ok')).toBeVisible()
  await page.getByTestId('add-to-design').click()
  await expect(page.getByRole('treeitem', { name: 'Spinner' })).toBeVisible()
  await page.getByTestId('add-box').click()
}

async function expectOnlySpinnerStuck(page: Page) {
  await page.getByRole('treeitem', { name: 'Spinner' }).click()
  await expect(page.getByRole('alert').filter({ hasText: TOO_LONG })).toBeVisible(AFTER_RESTART)
  await expect(page.getByText(STUCK_NOTICE)).toBeHidden()
  await page.getByRole('treeitem', { name: 'Box' }).click()
  await expect(page.getByRole('alert').filter({ hasText: "couldn't be built" })).toBeHidden()
}

test('a build() that never finishes only stops its own part', async ({ page }) => {
  test.setTimeout(150_000)
  await designWithSpinner(page)
  await page.getByRole('treeitem', { name: 'Spinner' }).click()
  await page.getByTestId('param-size').fill('60')
  await page.getByTestId('param-size').press('Enter')
  await expectOnlySpinnerStuck(page)
})

test('a design file whose shape loops while it loads only stops that part', async ({ page, browser }) => {
  test.setTimeout(150_000)
  await designWithSpinner(page)
  await page.getByTestId('open-designs').click()
  const saving = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Save to file' }).click()
  const saved = await (await saving).path()
  const loopAtLoad = SPINNER.replace('export default {', 'while (true) {}\nexport default {')
  const file = `${saved}-loops.json`
  await writeFile(file, (await readFile(saved, 'utf8')).replace(JSON.stringify(SPINNER).slice(1, -1), JSON.stringify(loopAtLoad).slice(1, -1)))

  const fresh = await browser.newContext()
  const other = await fresh.newPage()
  await openApp(other)
  await other.getByTestId('open-designs').click()
  await other.getByTestId('load-file').setInputFiles(file)
  await expectOnlySpinnerStuck(other)
  await fresh.close()
})
