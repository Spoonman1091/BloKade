import { expect, test } from '@playwright/test'

test('starts in dark mode, switches to light, and remembers it', async ({ page }) => {
  await page.goto('/')
  const root = page.locator('html')
  await expect(root).toHaveAttribute('data-theme', 'dark')
  const dark = await page.evaluate(() => getComputedStyle(document.documentElement).backgroundColor)

  await page.getByTestId('theme-toggle').click()
  await expect(root).toHaveAttribute('data-theme', 'light')
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).backgroundColor)).not.toBe(dark)

  await page.reload()
  await expect(root).toHaveAttribute('data-theme', 'light')
  await expect(page.getByTestId('theme-toggle')).toHaveAccessibleName('Switch to dark mode')
})

test('picks a colour theme that recolours the app and is remembered', async ({ page }) => {
  await page.goto('/')
  const root = page.locator('html')
  await expect(root).toHaveAttribute('data-color', 'ocean')
  const accent = () => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--accent').trim())
  const ocean = await accent()

  await page.getByTestId('theme-colors').click()
  await page.getByRole('radio', { name: 'Forest' }).click()
  await expect(root).toHaveAttribute('data-color', 'forest')
  expect(await accent()).not.toBe(ocean)

  await page.reload()
  await expect(root).toHaveAttribute('data-color', 'forest')
  await expect(root).toHaveAttribute('data-theme', 'dark')
})
