import { expect, test, type Page } from '@playwright/test'

async function openApp(page: Page): Promise<void> {
  await page.goto('/')
  await expect(page.getByText('Warming up the geometry engine…')).toBeHidden()
}

/** Types a value and waits until the field shows it, so the next value isn't overwritten by this one arriving late. */
async function setField(page: Page, testId: string, value: string): Promise<void> {
  await page.getByTestId(testId).fill(value)
  await page.getByTestId(testId).press('Enter')
  await expect(page.getByTestId(testId)).toHaveValue(value)
}

test('Check print finds a floating piece, Put on plate fixes it', async ({ page }) => {
  await openApp(page)
  await page.getByTestId('add-box').click()
  await expect(page.getByTestId('param-width')).toHaveValue('20')
  await setField(page, 'pos-x', '-40')
  await page.getByTestId('add-box').click()
  await expect(page.getByTestId('param-width')).toHaveValue('20')
  await setField(page, 'pos-x', '40')
  await setField(page, 'pos-z', '30')

  await page.getByTestId('check-print').click()
  await expect(page.getByTestId('print-check-result')).toContainText('1 piece is floating')

  await page.getByTestId('put-on-plate').click()
  await expect(page.getByTestId('pos-z')).toHaveValue('0')
  await page.getByTestId('check-print').click()
  await expect(page.getByTestId('print-check-result')).toContainText('Looks ready to print on the Bambu Lab A1 mini')
})

test('the D key puts the selected part on the plate', async ({ page }) => {
  await openApp(page)
  await page.getByTestId('add-box').click()
  await expect(page.getByTestId('param-width')).toHaveValue('20')
  await setField(page, 'pos-z', '30')
  await page.getByTestId('pos-z').blur()
  await page.locator('body').focus()
  await page.keyboard.press('d')
  await expect(page.getByTestId('pos-z')).toHaveValue('0')
})
