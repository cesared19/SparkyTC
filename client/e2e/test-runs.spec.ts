import { test, expect, type Page } from '@playwright/test'
import { createTestCase, startTestRun, testProject, unique } from './support'

// a 1×1 PNG, as evidence
const PNG = Buffer.from(
	'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
	'base64'
)

const step = (page: Page, n: number) =>
	page.getByRole('group', { name: `Result of step ${n}` })

async function openTestCaseInRun(
	page: Page,
	code: string,
	run: number,
	title: string
) {
	await page.goto(`/test-runs/${code}/${run}`)
	await page.getByRole('cell', { name: title }).first().click()
	await page.waitForURL(new RegExp(`/test-runs/${code}/${run}/\\d+$`))
	return page.url()
}

test('records a result with steps, a comment and evidence', async ({
	page,
}) => {
	const { code } = testProject()
	const withSteps = unique('Checkout with a coupon')
	const other = unique('Checkout without a coupon')
	await createTestCase(page, code, withSteps, [
		{ action: 'Add a coupon', expected: 'The discount shows' },
		{ action: 'Pay', expected: 'The order is confirmed' },
	])
	await createTestCase(page, code, other)
	const run = await startTestRun(page, code, unique('Checkout run'), [
		withSteps,
		other,
	])

	const caseURL = await openTestCaseInRun(page, code, run, withSteps)
	await expect(page.getByRole('button', { name: 'Save result' })).toBeDisabled()
	await step(page, 1).getByRole('button', { name: 'Pass' }).click()
	await step(page, 2).getByRole('button', { name: 'Fail' }).click()
	await page
		.getByRole('textbox', { name: 'Actual result of step 2' })
		.fill('The payment page spins forever')
	await page.fill('#resultNotes', 'Fails with any card')
	await page.setInputFiles('#resultEvidence', {
		name: 'spinner.png',
		mimeType: 'image/png',
		buffer: PNG,
	})
	// the result is suggested from the steps
	await expect(
		page
			.getByRole('group', { name: 'Result to save' })
			.getByRole('button', { name: 'Fail' })
	).toHaveAttribute('aria-pressed', 'true')
	await page.getByRole('button', { name: 'Save result' }).click()

	// on to the next test case, with a notice of what was saved
	await page.waitForURL(/saved=/)
	await expect(
		page.getByRole('status').filter({ hasText: 'Fail' }).first()
	).toBeVisible()

	await page.goto(caseURL)
	const results = page.locator('section', {
		has: page.getByRole('heading', { name: 'Results in this run' }),
	})
	await expect(results.getByText('Fails with any card')).toBeVisible()
	await expect(
		results.getByText('The payment page spins forever')
	).toBeVisible()
	await expect(results.locator('img').first()).toBeVisible()

	await page.goto(`/test-runs/${code}/${run}`)
	await expect(
		page
			.getByRole('row', { name: withSteps })
			.getByText('FAIL', { exact: true })
	).toBeVisible()
})

test('keeps an unsaved result as a draft', async ({ page }) => {
	const { code } = testProject()
	const title = unique('Search by name')
	await createTestCase(page, code, title, [
		{ action: 'Search "shoes"', expected: 'Shoes are listed' },
	])
	const run = await startTestRun(page, code, unique('Draft run'), [title])

	const caseURL = await openTestCaseInRun(page, code, run, title)
	await step(page, 1).getByRole('button', { name: 'Pass' }).click()
	await page
		.getByRole('textbox', { name: 'Actual result of step 1' })
		.fill('Three pairs listed')
	await page.fill('#resultNotes', 'Halfway through')
	// kept on the server shortly after the last change
	await expect(
		page
			.getByText(/^Draft kept/)
			.filter({ visible: true })
			.first()
	).toBeVisible()

	await page.goto(`/test-runs/${code}/${run}`)
	await page.goto(caseURL)
	await expect(
		page.getByRole('textbox', { name: 'Actual result of step 1' })
	).toHaveValue('Three pairs listed')
	await expect(page.locator('#resultNotes')).toHaveValue('Halfway through')
	await expect(
		step(page, 1).getByRole('button', { name: 'Pass' })
	).toHaveAttribute('aria-pressed', 'true')
})
