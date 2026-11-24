import { test, expect, type Page } from '@playwright/test'
import { AUTH_FILE, createProject, expectNoPageScroll, unique } from './support'

// three projects whose titles sort A, B, C and come after every other project the other tests made
async function createProjects(page: Page) {
	const stamp = Date.now().toString(36).toUpperCase()
	const prefix = unique('Zorder').replace(/\s/g, '-')
	const projects = ['A', 'B', 'C'].map((letter) => ({
		code: `Z${stamp}${letter}`,
		title: `${prefix} ${letter}`,
	}))
	for (const project of projects) {
		await createProject(page, project.code, project.title)
	}
	return { prefix, projects }
}

/** The titles in the project list, only the ones of this test, top to bottom. */
async function order(page: Page, prefix: string) {
	const titles = await page
		.getByRole('complementary')
		.locator('nav > div')
		.evaluateAll((rows) =>
			rows.map((row) => row.querySelector('span.truncate')?.textContent ?? '')
		)
	return titles
		.filter((title) => title.startsWith(prefix))
		.map((title) => title.slice(-1))
}

/** Waits for the save of the order to reach the server, before the page is loaded again. */
async function waitForSave(page: Page) {
	await page.waitForLoadState('networkidle')
}

async function resetOrder(page: Page) {
	await page.getByRole('button', { name: 'Reorder' }).click()
	await page.getByRole('button', { name: 'Reset to A-Z' }).click()
	await page.getByRole('button', { name: 'Done' }).click()
	await waitForSave(page)
}

test('moves a project with the arrows and keeps the order', async ({
	page,
}) => {
	const { prefix, projects } = await createProjects(page)
	await page.goto(`/projects/${projects[0].code}`)
	expect(await order(page, prefix)).toEqual(['A', 'B', 'C'])

	await page.getByRole('button', { name: 'Reorder' }).click()
	// the arrows work from the keyboard
	const up = page.getByRole('button', { name: `Move ${prefix} C up` })
	await up.focus()
	await page.keyboard.press('Enter')
	await page.getByRole('button', { name: `Move ${prefix} C up` }).click()
	await expect(page.getByRole('status')).toContainText('moved to position')
	expect(await order(page, prefix)).toEqual(['C', 'A', 'B'])
	await expect(
		page.getByRole('button', { name: `Move ${prefix} C down` })
	).toBeEnabled()
	await page.getByRole('button', { name: 'Done' }).click()
	await waitForSave(page)

	// still there after reloading, and in another project's page
	await page.reload()
	expect(await order(page, prefix)).toEqual(['C', 'A', 'B'])
	await page.goto(`/projects/${projects[2].code}`)
	expect(await order(page, prefix)).toEqual(['C', 'A', 'B'])

	// a project that's new goes at the end of the ones in the list
	await resetOrder(page)
	await page.reload()
	expect(await order(page, prefix)).toEqual(['A', 'B', 'C'])
})

test('drags a project to a new place', async ({ page }) => {
	const { prefix, projects } = await createProjects(page)
	await page.goto(`/projects/${projects[0].code}`)
	await page.getByRole('button', { name: 'Reorder' }).click()

	const grip = page.getByRole('button', { name: `Drag ${prefix} C to move it` })
	const target = page.getByRole('button', {
		name: `Drag ${prefix} A to move it`,
	})
	// the list can be long, with the projects of earlier runs
	await grip.scrollIntoViewIfNeeded()
	const from = (await grip.boundingBox())!
	const to = (await target.boundingBox())!
	await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2)
	await page.mouse.down()
	await page.mouse.move(to.x + to.width / 2, to.y + 2, { steps: 8 })
	await page.mouse.up()

	expect(await order(page, prefix)).toEqual(['C', 'A', 'B'])
	await page.getByRole('button', { name: 'Done' }).click()
	await waitForSave(page)
	await page.reload()
	expect(await order(page, prefix)).toEqual(['C', 'A', 'B'])
	await resetOrder(page)
})

test('reordering works in the phone drawer', async ({ browser }) => {
	const context = await browser.newContext({
		storageState: AUTH_FILE,
		viewport: { width: 390, height: 844 },
		isMobile: true,
		hasTouch: true,
	})
	const page = await context.newPage()
	const { prefix, projects } = await createProjects(page)
	await page.goto(`/projects/${projects[0].code}`)

	await page.getByRole('button', { name: 'Switch project' }).click()
	await page.getByRole('button', { name: 'Reorder' }).click()
	await page.getByRole('button', { name: `Move ${prefix} B up` }).click()
	expect(await order(page, prefix)).toEqual(['B', 'A', 'C'])
	await expectNoPageScroll(page, 'the reordering drawer')
	await page.getByRole('button', { name: 'Done' }).click()
	await page.getByRole('button', { name: 'Reorder' }).click()
	await page.getByRole('button', { name: 'Reset to A-Z' }).click()
	expect(await order(page, prefix)).toEqual(['A', 'B', 'C'])
	await context.close()
})
