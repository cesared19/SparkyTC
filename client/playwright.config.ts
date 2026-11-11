import { defineConfig, devices } from '@playwright/test'

/**
 * End-to-end tests in e2e/, run with `npm run e2e` against an app that is already running (the production build,
 * see CONTRIBUTING.md). They create their own project and data, so any database works, but use one for testing.
 */
export default defineConfig({
	testDir: './e2e',
	// the tests share the app and the project made by the setup, so they run one at a time
	workers: 1,
	fullyParallel: false,
	forbidOnly: true,
	retries: 0,
	timeout: 60_000,
	expect: { timeout: 10_000 },
	outputDir: './e2e-results',
	reporter: [
		['list'],
		['html', { outputFolder: './e2e-report', open: 'never' }],
	],
	use: {
		baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000',
		trace: 'retain-on-failure',
		screenshot: 'only-on-failure',
		launchOptions: {
			// a Chromium already on the machine, instead of the one `npx playwright install chromium` downloads
			executablePath: process.env.E2E_CHROMIUM_PATH || undefined,
		},
	},
	projects: [
		{ name: 'setup', testMatch: /setup\.ts/ },
		{
			name: 'chromium',
			use: {
				...devices['Desktop Chrome'],
				storageState: './e2e-results/.auth/admin.json',
			},
			dependencies: ['setup'],
		},
	],
})
