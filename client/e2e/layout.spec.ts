import { test, expect, type Browser } from '@playwright/test'
import {
	AUTH_FILE,
	createTestCase,
	expectNoPageScroll,
	startTestRun,
	testProject,
	unique,
} from './support'

// Every page at a phone, a tablet and a desktop width, in light and dark mode: it shows without errors and the
// document never scrolls as a whole past its content (CLAUDE.md, Layout).
const SCREENS = [
	{
		name: 'phone',
		viewport: { width: 390, height: 844 },
		isMobile: true,
		hasTouch: true,
	},
	{
		name: 'tablet',
		viewport: { width: 820, height: 1180 },
		isMobile: true,
		hasTouch: true,
	},
	{
		name: 'desktop',
		viewport: { width: 1280, height: 800 },
		isMobile: false,
		hasTouch: false,
	},
]
const THEMES = ['light', 'dark'] as const

let pages: string[] = []

test.beforeAll(async ({ browser }) => {
	pages = await pagesToCheck(browser)
})

for (const screen of SCREENS) {
	for (const theme of THEMES) {
		test(`every page fits the window: ${screen.name}, ${theme}`, async ({
			browser,
		}) => {
			const context = await browser.newContext({
				storageState: AUTH_FILE,
				viewport: screen.viewport,
				isMobile: screen.isMobile,
				hasTouch: screen.hasTouch,
				colorScheme: theme,
			})
			const page = await context.newPage()
			const errors: string[] = []
			page.on('pageerror', (error) =>
				errors.push(`${page.url()}: ${error.message}`)
			)

			for (const path of pages) {
				await test.step(path, async () => {
					const response = await page.goto(path)
					expect.soft(response?.status(), `${path} answers`).toBeLessThan(400)
					await page.waitForLoadState('networkidle').catch(() => undefined)
					await expect
						.soft(page.locator('html'), `${path} follows the ${theme} theme`)
						.toHaveClass(theme === 'dark' ? /\bdark\b/ : /^(?!.*\bdark\b)/)
					await expectNoPageScroll(page, path)
				})
			}

			// signed out, the sign-in page
			await context.clearCookies()
			await page.goto('/login')
			await expectNoPageScroll(page, '/login')

			expect(errors, 'no errors in the pages').toEqual([])
			await context.close()
		})
	}
}

/** Creates what the pages need to show something: a test case with steps, a plan and a run. */
async function pagesToCheck(browser: Browser) {
	const { code } = testProject()
	const context = await browser.newContext({ storageState: AUTH_FILE })
	const page = await context.newPage()

	const title = unique('Layout check')
	const testCase = await createTestCase(page, code, title, [
		{ action: 'Open the page', expected: 'It fits the window' },
	])
	const run = await startTestRun(page, code, unique('Layout run'), [title])
	await page.getByRole('cell', { name: title }).first().click()
	await page.waitForURL(new RegExp(`/test-runs/${code}/${run}/\\d+$`))
	const testCaseRun = new URL(page.url()).pathname

	await page.goto(`/test-plans/${code}/new`)
	await page.fill('#planName', unique('Layout plan'))
	await page.getByRole('searchbox', { name: 'Search test cases' }).fill(title)
	await page
		.locator('label', { hasText: title })
		.locator('input[type=checkbox]')
		.check()
	await page.click('button:text-is("Save test plan")')
	await page.waitForURL(new RegExp(`/test-plans/${code}/[0-9a-f-]{36}$`))
	const plan = new URL(page.url()).pathname
	await context.close()

	return [
		'/',
		`/projects/${code}`,
		`/projects/${code}/builds`,
		`/projects/${code}/settings`,
		`/test-cases/${code}`,
		`/test-cases/${code}/new`,
		`/test-cases/${code}/import`,
		`/test-cases/${code}/shared-steps`,
		`/test-cases/${code}/${testCase}`,
		`/test-cases/${code}/${testCase}/edit`,
		`/test-plans/${code}`,
		`/test-plans/${code}/new`,
		plan,
		`${plan}/edit`,
		`/test-runs/${code}`,
		`/test-runs/${code}/new`,
		`/test-runs/${code}/${run}`,
		`/test-runs/${code}/${run}/edit`,
		testCaseRun,
		'/projects/new',
		'/account',
		'/admin/users',
		'/configuration/properties',
		'/configuration/properties/new',
	]
}
