import { expect, test, type Page } from '@playwright/test'

async function boxOnPlate(page: Page): Promise<void> {
  await page.goto('/')
  await expect(page.getByText('Warming up the geometry engine…')).toBeHidden()
  await page.getByTestId('add-box').click()
  await expect(page.getByTestId('param-width')).toHaveValue('20')
}

/** Types a value and waits until the box shows it, so the next value isn't overwritten by this one arriving late. */
async function setField(page: Page, testId: string, value: string): Promise<void> {
  await page.getByTestId(testId).fill(value)
  await page.getByTestId(testId).press('Enter')
  await expect(page.getByTestId(testId)).toHaveValue(value)
}

const misfits = (page: Page) => page.locator('[data-misfits]')

test('a part moved off the A1 mini plate turns red with a warning, and back', async ({ page }) => {
  await boxOnPlate(page)
  await expect(page.getByRole('combobox', { name: 'Printer' })).toHaveValue('bambu-a1-mini')
  await expect(page.getByTestId('fit-warning')).toBeHidden()
  await setField(page, 'pos-x', '200')
  await expect(page.getByTestId('fit-warning')).toHaveText("Box doesn't fit on the Bambu Lab A1 mini. Move it onto the plate or make it smaller.")
  await expect(misfits(page)).not.toHaveAttribute('data-misfits', '')
  await setField(page, 'pos-x', '0')
  await expect(page.getByTestId('fit-warning')).toBeHidden()
  await expect(misfits(page)).toHaveAttribute('data-misfits', '')
})

test('a part taller than the printer says so, and No printer turns the check off', async ({ page }) => {
  await boxOnPlate(page)
  await setField(page, 'param-height', '200')
  await expect(page.getByTestId('fit-warning')).toContainText("It's taller than 180 mm.")
  await page.getByRole('combobox', { name: 'Printer' }).selectOption('none')
  await expect(page.getByTestId('fit-warning')).toBeHidden()
  await page.reload()
  await expect(page.getByRole('combobox', { name: 'Printer' })).toHaveValue('none')
})
