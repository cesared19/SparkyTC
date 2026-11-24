import { test as setup } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import {
	ADMIN_PASSWORD,
	ADMIN_USERNAME,
	AUTH_FILE,
	PROJECT_FILE,
	createProject,
	signIn,
} from './support'

// Signs in as the admin once and creates a project of its own for this run of the tests.
setup('sign in and create a project', async ({ page }) => {
	await signIn(page, ADMIN_USERNAME, ADMIN_PASSWORD)

	const code = `E${Date.now().toString(36).toUpperCase().slice(-6)}`
	const title = `E2E ${code}`
	await createProject(page, code, title)

	mkdirSync(dirname(AUTH_FILE), { recursive: true })
	await page.context().storageState({ path: AUTH_FILE })
	writeFileSync(PROJECT_FILE, JSON.stringify({ code, title }))
})
