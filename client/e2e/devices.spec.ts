import { test, expect } from '@playwright/test'
import { createProject, createTestCase, startTestRun, unique } from './support'

// SparkStock is optional: with it the picker lists devices, without it (or when it's down) the tester types the tag
test('records the device a result ran on, when the project asks for it', async ({
	page,
}) => {
	const code = `D${Date.now().toString(36).slice(-5).toUpperCase()}`
	await createProject(page, code, unique('Devices project'))
	const title = unique('Grab an object')
	await createTestCase(page, code, title)

	await page.goto(`/projects/${code}/settings`)
	await page.getByRole('radio', { name: /^Required/ }).check()
	await page.getByRole('button', { name: 'Save settings' }).click()
	await expect(page.getByText('Settings saved')).toBeVisible()

	const run = await startTestRun(page, code, unique('Device run'), [title])
	await page.goto(`/test-runs/${code}/${run}`)
	await page.getByRole('cell', { name: title }).first().click()
	await page.waitForURL(new RegExp(`/test-runs/${code}/${run}/\\d+$`))

	await page
		.getByRole('group', { name: 'Result to save' })
		.getByRole('button', { name: 'Pass' })
		.click()
	const save = page.getByRole('button', { name: 'Save result' })
	await expect(save).toBeDisabled()
	await expect(page.getByText('Choose the device you tested on')).toBeVisible()

	const picker = page.getByTestId('device-picker')
	const device = picker.getByLabel('Device', { exact: true })
	// wait for the picker to know whether SparkStock answers
	await expect(device).toBeEnabled()
	let chosen = 'E2E-0001'
	if ((await device.evaluate((el) => el.tagName)) === 'SELECT') {
		await picker.getByRole('searchbox').fill('VR')
		const option = device.locator('option:not([value=""])').first()
		await expect(option).toBeAttached()
		chosen = (await option.getAttribute('value')) ?? ''
		await device.selectOption(chosen)
	} else {
		await device.fill(chosen)
	}
	await expect(save).toBeEnabled()
	await save.click()
	await page.waitForURL(/saved=/)

	// the result says which device it ran on, and the next test case starts with it
	await page.goto(`/test-runs/${code}/${run}`)
	await page.getByRole('cell', { name: title }).first().click()
	await expect(page.locator('p', { hasText: 'Device:' })).toContainText(chosen)
	await expect(
		page.getByTestId('device-picker').getByLabel('Device', { exact: true })
	).toHaveValue(chosen)
})
