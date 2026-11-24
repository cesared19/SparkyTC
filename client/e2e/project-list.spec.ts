import { test, expect, type Page } from '@playwright/test'
import {
	AUTH_FILE,
	createProject,
	expectNoPageScroll,
	testProject,
	unique,
} from './support'

// other pages have sidebars of their own (the sections of the test cases)
const projectList = (page: Page) =>
	page.locator('aside', {
		has: page.getByRole('heading', { name: 'Projects', level: 2 }),
	})

test('hides the project list and shows it again, and remembers it', async ({
	page,
}) => {
	const { code, title } = testProject()
	await page.goto(`/projects/${code}`)
	const list = projectList(page)
	const hide = page.getByRole('button', { name: 'Hide project list' })
	const show = page.getByRole('button', { name: 'Show project list' })
	const content = page.getByRole('navigation', { name: 'Project views' })

	await expect(list).toBeVisible()
	await expect(show).toBeHidden()
	const widthWithList = (await content.boundingBox())!.width

	await hide.click()
	await expect(list).toBeHidden()
	await expect(show).toBeVisible()
	await expect(show).toBeFocused()
	await expect(show).toHaveAttribute('aria-expanded', 'false')
	// the page gets the room of the list
	expect((await content.boundingBox())!.width).toBeGreaterThan(
		widthWithList + 200
	)
	await expect(page.getByRole('heading', { name: title })).toBeVisible()

	// it stays hidden after reloading, from the first paint, and in other pages
	await page.reload({ waitUntil: 'domcontentloaded' })
	expect(
		await page.evaluate(() => document.documentElement.dataset.projectList)
	).toBe('hidden')
	await expect(list).toBeHidden()
	await content.getByRole('link', { name: 'Test Cases' }).click()
	await page.waitForURL(new RegExp(`/test-cases/${code}`))
	await expect(list).toBeHidden()
	await expect(show).toBeVisible()

	await show.click()
	await expect(list).toBeVisible()
	await expect(show).toBeHidden()
	await expect(hide).toBeFocused()
	await page.reload()
	await expect(list).toBeVisible()
})

test("the hide button works with the keyboard and isn't offered while reordering", async ({
	page,
}) => {
	const { code } = testProject()
	// Reorder needs more than one project
	const stamp = Date.now().toString(36).toUpperCase()
	await createProject(page, `L${stamp}`, unique('List project'))
	await page.goto(`/projects/${code}`)
	const list = projectList(page)

	await page.getByRole('button', { name: 'Reorder' }).click()
	await expect(
		page.getByRole('button', { name: 'Hide project list' })
	).toHaveCount(0)
	await page.getByRole('button', { name: 'Done' }).click()

	await page.getByRole('button', { name: 'Hide project list' }).focus()
	await page.keyboard.press('Enter')
	await expect(list).toBeHidden()
	await page.keyboard.press('Enter')
	await expect(list).toBeVisible()
})

test('on a phone the list stays a drawer, even if it is hidden on desktop', async ({
	browser,
}) => {
	const { code } = testProject()
	const context = await browser.newContext({
		storageState: AUTH_FILE,
		viewport: { width: 390, height: 844 },
		isMobile: true,
		hasTouch: true,
	})
	await context.addInitScript(() =>
		localStorage.setItem('sparky.projectListHidden', '1')
	)
	const page = await context.newPage()
	await page.goto(`/projects/${code}`)

	await expect(
		page.getByRole('button', { name: 'Show project list' })
	).toBeHidden()
	await page.getByRole('button', { name: 'Switch project' }).click()
	await expect(projectList(page)).toBeVisible()
	await expect(
		page.getByRole('button', { name: 'Hide project list' })
	).toHaveCount(0)
	await expectNoPageScroll(page, 'the drawer')
	await context.close()
})
