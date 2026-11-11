import { test, expect } from '@playwright/test'
import { createTestCase, testProject, unique } from './support'

test('creates a test case with text instructions', async ({ page }) => {
	const { code } = testProject()
	const title = unique('Sign in with a valid password')
	const number = await createTestCase(page, code, title)
	await expect(
		page.getByText(title).filter({ visible: true }).first()
	).toBeVisible()
	await page.goto(`/test-cases/${code}`)
	await expect(
		page.getByText(title).filter({ visible: true }).first()
	).toBeVisible()
	expect(number).toBeGreaterThan(0)
})

test('creates a test case with steps', async ({ page }) => {
	const { code } = testProject()
	const title = unique('Pay with a saved card')
	await createTestCase(page, code, title, [
		{ action: 'Open the cart', expected: 'The cart shows the items' },
		{ action: 'Pay with the saved card', expected: 'The order is confirmed' },
	])
	await expect(
		page.getByText('Open the cart').filter({ visible: true }).first()
	).toBeVisible()
	await expect(
		page.getByText('The order is confirmed').filter({ visible: true }).first()
	).toBeVisible()
})
