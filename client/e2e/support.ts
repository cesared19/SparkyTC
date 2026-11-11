import { expect, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'

export const ADMIN_USERNAME = process.env.E2E_ADMIN_USERNAME ?? 'admin'
export const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? 'admin-password'

export const AUTH_FILE = './e2e-results/.auth/admin.json'
export const PROJECT_FILE = './e2e-results/.auth/project.json'

/** The project the setup created for this run of the tests. */
export function testProject(): { code: string; title: string } {
	return JSON.parse(readFileSync(PROJECT_FILE, 'utf8'))
}

/** A name nobody else used, so the tests can run again on the same database. */
export function unique(prefix: string) {
	return `${prefix} ${Date.now().toString(36)}${Math.floor(
		Math.random() * 1000
	)}`
}

export async function signIn(page: Page, username: string, password: string) {
	await page.goto('/login')
	await page.fill('input[name=username]', username)
	await page.fill('input[name=password]', password)
	await page.click('button[type=submit]')
	await page.waitForURL((url) => !url.pathname.startsWith('/login'))
}

/** Creates a test case and returns its number. Steps make it a test case in the Steps format. */
export async function createTestCase(
	page: Page,
	code: string,
	title: string,
	steps: { action: string; expected?: string }[] = []
) {
	await page.goto(`/test-cases/${code}/new`)
	await page.fill('#title', title)
	if (steps.length > 0) {
		await page.click('button[role=radio]:text-is("Steps")')
		for (const [index, step] of steps.entries()) {
			// switching to Steps starts with one empty step
			const actions = page.getByRole('textbox', { name: 'Action', exact: true })
			if ((await actions.count()) <= index)
				await page.click('button:text-is("Add step")')
			await page
				.getByRole('textbox', { name: 'Action', exact: true })
				.nth(index)
				.fill(step.action)
			if (step.expected)
				await page
					.getByRole('textbox', { name: 'Expected result', exact: true })
					.nth(index)
					.fill(step.expected)
		}
	} else {
		await page.fill('#testInstructions', `Do what "${title}" says`)
	}
	await page.click('button[type=submit]:text-is("Create")')
	// back on the list, open the new test case to learn its number
	await page.waitForURL(new RegExp(`/test-cases/${code}(\\?.*)?$`))
	await page.getByRole('cell', { name: title, exact: true }).click()
	await page.waitForURL(new RegExp(`/test-cases/${code}/\\d+$`))
	return Number(new URL(page.url()).pathname.split('/').pop())
}

/** Starts a test run with the given test cases and returns its number. */
export async function startTestRun(
	page: Page,
	code: string,
	title: string,
	testCaseTitles: string[]
) {
	await page.goto(`/test-runs/${code}/new`)
	await page.fill('#title', title)
	await page.click('button:text-is("Change Selection")')
	for (const testCase of testCaseTitles) {
		await page.fill('input[placeholder="Search test cases..."]', testCase)
		await page.getByRole('row', { name: testCase }).click()
	}
	await page.click('button:text-is("Done")')
	await page.click('button:text-is("Create Test Run")')
	await page.waitForURL(new RegExp(`/test-runs/${code}(\\?.*)?$`))
	await page.getByRole('cell', { name: title, exact: true }).click()
	await page.waitForURL(new RegExp(`/test-runs/${code}/\\d+$`))
	return Number(new URL(page.url()).pathname.split('/').pop())
}

/** The page fits the window: the document doesn't scroll as a whole past its content. */
export async function expectNoPageScroll(page: Page, path = page.url()) {
	const sizes = await page.evaluate(() => ({
		scrollHeight: document.scrollingElement?.scrollHeight ?? 0,
		scrollWidth: document.scrollingElement?.scrollWidth ?? 0,
		height: window.innerHeight,
		width: window.innerWidth,
	}))
	expect
		.soft(sizes.scrollHeight, `${path} is taller than the window`)
		.toBeLessThanOrEqual(sizes.height)
	expect
		.soft(sizes.scrollWidth, `${path} is wider than the window`)
		.toBeLessThanOrEqual(sizes.width)
}
