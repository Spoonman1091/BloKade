import { expect, test, type Page } from '@playwright/test'

async function setField(page: Page, testId: string, value: string) {
  await page.getByTestId(testId).fill(value)
  await page.getByTestId(testId).press('Enter')
}

async function startTutorial(page: Page, id: string) {
  await page.goto('/')
  await expect(page.getByText('Warming up the geometry engine…')).toBeHidden()
  await page.getByTestId('learn').click()
  await page.getByTestId(`lesson-start-${id}`).click()
  await expect(page.getByTestId('lesson-step')).toBeVisible()
}

const step = (page: Page) => page.getByTestId('lesson-step')
const next = (page: Page) => page.getByTestId('lesson-next').click()
const finished = (page: Page) => expect(page.getByTestId('lesson-finished')).toBeVisible()
const row = (page: Page, name: string) => page.getByRole('treeitem', { name, exact: true })

test('Your first shape', async ({ page }) => {
  await startTutorial(page, 'first-shape')
  await page.getByTestId('add-box').click()
  await expect(step(page)).toContainText('Width')
  await setField(page, 'param-width', '40')
  await expect(step(page)).toContainText('Look around')
  await next(page)
  await expect(step(page)).toContainText('Esc')
  await page.keyboard.press('Escape')
  await expect(step(page)).toContainText('click the box again')
  await row(page, 'Box').click()
  await finished(page)
})

test('Move, turn and size', async ({ page }) => {
  await startTutorial(page, 'move-turn-size')
  await page.getByTestId('add-cylinder').click()
  await setField(page, 'pos-y', '10')
  await expect(step(page)).toContainText('Type 30')
  await setField(page, 'pos-x', '30')
  await page.getByTestId('tool-rotate').click()
  await setField(page, 'rot-y', '45')
  await page.getByTestId('tool-size').click()
  await setField(page, 'param-height', '40')
  await page.getByTestId('tool-move').click()
  await finished(page)
})

test('Holes and groups', async ({ page }) => {
  await startTutorial(page, 'holes-groups')
  await page.getByTestId('add-box').click()
  await page.getByTestId('add-cylinder').click()
  await page.getByTestId('mode-hole').click()
  await row(page, 'Box').click()
  await row(page, 'Cylinder').click({ modifiers: ['Shift'] })
  await page.getByTestId('group').click()
  await expect(step(page)).toContainText('Ungroup')
  await next(page)
  await finished(page)
})

test('Undo, names and saving', async ({ page }) => {
  await startTutorial(page, 'undo-save')
  await page.getByTestId('add-sphere').click()
  await page.getByTestId('delete').click()
  await page.getByTestId('undo').click()
  await expect(step(page)).toContainText('Redo')
  await page.getByTestId('redo').click()
  await page.getByTestId('undo').click()
  await expect(step(page)).toContainText('📁')
  await page.getByTestId('open-designs').click()
  await setField(page, 'design-name', 'My practice')
  await expect(step(page)).toContainText('Save to file')
  await page.getByRole('button', { name: 'Close', exact: true }).click()
  await next(page)
  await finished(page)
})

test('Smart sizes', async ({ page }) => {
  await startTutorial(page, 'smart-sizes')
  await page.getByTestId('add-box').click()
  await page.getByTestId('add-variable').click()
  await setField(page, 'var-name-var1', 'wall')
  await setField(page, 'var-expr-wall', '3')
  await row(page, 'Box').click()
  await setField(page, 'param-width', 'wall * 10')
  await page.getByTestId('add-cylinder').click()
  await setField(page, 'param-diameter', 'wall * 5')
  await expect(step(page)).toContainText('change wall')
  await setField(page, 'var-expr-wall', '4')
  await finished(page)
})

test('Build on a face', async ({ page }) => {
  await startTutorial(page, 'workplane')
  await page.getByTestId('add-box').click()
  await page.getByTestId('workplane').click()
  await expect(step(page)).toContainText('face of the box')
  // The box takes a moment to appear in the 3D view; keep clicking its middle until a face is picked.
  await expect(async () => {
    await page.getByTestId('viewport').click()
    await expect(step(page)).toContainText('Cone', { timeout: 1000 })
  }).toPass({ timeout: 30_000 })
  await page.getByTestId('add-cone').click()
  await page.getByTestId('workplane-reset').click()
  await finished(page)
})

test('Round and repeat', async ({ page }) => {
  await startTutorial(page, 'round-repeat')
  await page.getByTestId('add-box').click()
  await page.getByTestId('add-modifier').selectOption('fillet')
  await setField(page, 'mod-radius-0', '3')
  await page.getByTestId('add-modifier').selectOption('linearPattern')
  await setField(page, 'mod-count-1', '4')
  await page.getByTestId('add-modifier').selectOption('mirror')
  await finished(page)
})

test('Perfect fit', async ({ page }) => {
  await startTutorial(page, 'perfect-fit')
  await page.getByTestId('add-kit-peg-socket').click()
  await next(page)
  await setField(page, 'fit', '0.3')
  await page.getByTestId('check-overlap').click()
  await finished(page)
})

test('Ready to print', async ({ page }) => {
  await startTutorial(page, 'ready-to-print')
  await page.getByTestId('add-box').click()
  for (const snippet of ['STL', '3MF', 'slicer']) {
    await expect(step(page)).toContainText(snippet)
    await next(page)
  }
  await finished(page)
})

test('help mode explains a button without pressing it', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('Warming up the geometry engine…')).toBeHidden()
  await page.getByTestId('help-mode').click()
  await page.getByTestId('add-box').click()
  await expect(page.getByTestId('help-card')).toContainText('Click to add a Box')
  await expect(page.getByRole('treeitem', { name: 'Box' })).toHaveCount(0)
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('help-card')).toBeHidden()
  await page.getByTestId('add-box').click()
  await expect(page.getByRole('treeitem', { name: 'Box' })).toHaveCount(1)
})
