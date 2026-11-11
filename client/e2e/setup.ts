import { test as setup, expect } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import {
	ADMIN_PASSWORD,
	ADMIN_USERNAME,
	AUTH_FILE,
	PROJECT_FILE,
	signIn,
} from './support'

// Signs in as the admin once and creates a project of its own for this run of the tests.
setup('sign in and create a project', async ({ page }) => {
	await signIn(page, ADMIN_USERNAME, ADMIN_PASSWORD)

	const code = `E${Date.now().toString(36).toUpperCase().slice(-6)}`
	const title = `E2E ${code}`
	await page.goto('/projects/new')
	await page.fill('#title', title)
	await page.fill('#shortCode', code)
	// the form's own button: the navigation has a submit button too (Sign out)
	await page.locator('form:has(#shortCode) button[type=submit]').click()
	await page.waitForURL((url) => !url.pathname.startsWith('/projects/new'))
	await page.goto(`/projects/${code}`)
	await expect(
		page.getByText(title).filter({ visible: true }).first()
	).toBeVisible()

	mkdirSync(dirname(AUTH_FILE), { recursive: true })
	await page.context().storageState({ path: AUTH_FILE })
	writeFileSync(PROJECT_FILE, JSON.stringify({ code, title }))
})
