import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { createTestCase, testProject, unique } from './support'

test('a test plan starts a test run with its test cases', async ({ page }) => {
	const { code } = testProject()
	const inPlan = unique('Refund an order')
	const notInPlan = unique('Cancel an order')
	await createTestCase(page, code, inPlan)
	await createTestCase(page, code, notInPlan)

	const plan = unique('Refunds')
	await page.goto(`/test-plans/${code}/new`)
	await page.fill('#planName', plan)
	await page.getByRole('searchbox', { name: 'Search test cases' }).fill(inPlan)
	await page
		.locator('label', { hasText: inPlan })
		.locator('input[type=checkbox]')
		.check()
	await page.click('button:text-is("Save test plan")')
	await page.waitForURL(new RegExp(`/test-plans/${code}/[0-9a-f-]{36}$`))
	await expect(
		page.getByText(inPlan).filter({ visible: true }).first()
	).toBeVisible()

	await page.getByRole('link', { name: 'Start test run' }).click()
	await page.waitForURL(/\/new\?plan=/)
	await expect(page.getByText('1 test cases selected')).toBeVisible()
	const runTitle = unique('Refunds run')
	await page.fill('#title', runTitle)
	await page.click('button:text-is("Create Test Run")')
	await page.waitForURL(new RegExp(`/test-runs/${code}(\\?.*)?$`))
	await page.getByRole('cell', { name: runTitle, exact: true }).click()
	await expect(page.getByRole('row', { name: inPlan })).toBeVisible()
	await expect(page.getByRole('row', { name: notInPlan })).toHaveCount(0)
})

test('bulk edit adds a label to the selected test cases', async ({ page }) => {
	const { code } = testProject()
	const first = unique('Change the shipping address')
	const second = unique('Change the billing address')
	await createTestCase(page, code, first)
	await createTestCase(page, code, second)
	const label = `bulk-${Date.now().toString(36)}`

	await page.goto(`/test-cases/${code}`)
	await page.click('button:text-is("Select")')
	await page.getByRole('row', { name: first }).click()
	await page.getByRole('row', { name: second }).click()
	await page.selectOption('select[aria-label="Bulk action"]', 'addLabels')
	await page.fill('#bulkLabels', label)
	await page.press('#bulkLabels', 'Enter')
	await page.click('button:text-is("Apply")')

	await expect(
		page.getByRole('row', { name: first }).getByText(label)
	).toBeVisible()
	await expect(
		page.getByRole('row', { name: second }).getByText(label)
	).toBeVisible()
})

test('exports the test cases as CSV', async ({ page }) => {
	const { code } = testProject()
	const title = unique('Export me')
	await createTestCase(page, code, title)

	await page.goto(`/test-cases/${code}`)
	await page.getByRole('button', { name: 'Export' }).click()
	const [download] = await Promise.all([
		page.waitForEvent('download'),
		page.getByRole('menuitem', { name: 'CSV (.csv)' }).click(),
	])
	expect(download.suggestedFilename()).toMatch(/\.csv$/)
	const csv = readFileSync(await download.path(), 'utf8')
	expect(csv.split('\n')[0]).toContain('Title')
	expect(csv).toContain(title)
})

test('an API token is shown once and can be revoked', async ({ page }) => {
	const { code } = testProject()
	const name = unique('e2e token')
	await page.goto(`/projects/${code}/settings`)
	await page.fill('#new-api-token', name)
	await page.getByRole('radio', { name: /Read and write/ }).check()
	await page.getByRole('button', { name: 'Create token' }).click()

	await expect(
		page.getByText("Copy the token now. It won't be shown again.")
	).toBeVisible()
	const secret = (
		await page
			.locator('code')
			.filter({ hasText: /\S{20,}/ })
			.first()
			.innerText()
	).trim()
	expect(secret.length).toBeGreaterThan(20)

	// the integration API answers to it, through the app's port
	const response = await page.request.get('/api/integration/v1/project', {
		headers: { Authorization: `Bearer ${secret}` },
	})
	expect(response.status()).toBe(200)
	const body = await response.json()
	expect((body.data ?? body).permissions).toContain('write')

	const row = page.locator('li', { hasText: name })
	await row.getByRole('button', { name: 'Revoke' }).click()
	await row.getByRole('button', { name: 'Revoke' }).click()
	await expect(page.locator('li', { hasText: name })).toHaveCount(0)
	const revoked = await page.request.get('/api/integration/v1/project', {
		headers: { Authorization: `Bearer ${secret}` },
	})
	expect(revoked.status()).toBe(401)
})
