import { expect, test, type Page } from '@playwright/test'

const WIDTHS = [1024, 1280, 1600]

async function noSidewaysScroll(page: Page) {
  const sizes = await page.evaluate(() => ({ page: document.documentElement.scrollWidth, window: window.innerWidth }))
  expect(sizes.page).toBeLessThanOrEqual(sizes.window)
}

async function onScreen(page: Page, testId: string) {
  const box = await page.getByTestId(testId).boundingBox()
  const width = page.viewportSize()?.width ?? 0
  expect(box).not.toBeNull()
  expect(box!.x).toBeGreaterThanOrEqual(0)
  expect(box!.x + box!.width).toBeLessThanOrEqual(width)
}

for (const width of WIDTHS) {
  test(`everything fits a ${width} px window with Learn open`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 })
    await page.goto('/')
    await expect(page.getByText('Warming up the geometry engine…')).toBeHidden()
    await page.getByTestId('learn').click()
    await expect(page.getByTestId('lessons-panel')).toBeVisible()
    await noSidewaysScroll(page)
    await onScreen(page, 'lessons-panel')
    await onScreen(page, 'add-box')
    await expect(page.locator('.right-panel')).toBeVisible()
    const view = await page.locator('.viewport').boundingBox()
    expect(view!.width).toBeGreaterThanOrEqual(300)
  })

  test(`everything fits a ${width} px window in My shapes`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 })
    await page.goto('/')
    await expect(page.getByText('Warming up the geometry engine…')).toBeHidden()
    await page.getByTestId('my-shapes').click()
    await expect(page.getByTestId('back-to-design')).toBeVisible()
    await noSidewaysScroll(page)
    await onScreen(page, 'back-to-design')
  })
}

test('a lesson can use the properties panel in a narrow window', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 })
  await page.goto('/')
  await expect(page.getByText('Warming up the geometry engine…')).toBeHidden()
  await page.getByTestId('learn').click()
  await page.getByTestId('lesson-start-first-shape').click()
  await page.getByTestId('add-box').click()
  await expect(page.getByTestId('lesson-step')).toContainText('Width')
  await onScreen(page, 'lesson-step')
  await onScreen(page, 'param-width')
  await page.getByTestId('param-width').fill('40')
  await page.getByTestId('param-width').press('Enter')
  await expect(page.getByTestId('lesson-step')).toContainText('Look around')
  await noSidewaysScroll(page)
})
