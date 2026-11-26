import js from '@eslint/js'
import importPlugin from 'eslint-plugin-import'
import jsxA11y from 'eslint-plugin-jsx-a11y'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import globals from 'globals'
import tseslint from 'typescript-eslint'

/**
 * ESLint 9 flat configuration. The rules are the same as before the move from .eslintrc: the recommended sets of
 * ESLint, React (with the JSX runtime), the hooks rules, jsx-a11y, import and typescript-eslint.
 */
export default tseslint.config(
	{
		// what .gitignore left out of the lint
		ignores: ['build/', '.cache/', 'e2e-results/', 'e2e-report/'],
	},

	// Base config
	js.configs.recommended,
	{
		// ESLint 8's recommended set had it, ESLint 9's doesn't
		rules: { 'no-inner-declarations': 'error' },
		languageOptions: {
			ecmaVersion: 'latest',
			sourceType: 'module',
			parserOptions: { ecmaFeatures: { jsx: true } },
			globals: { ...globals.browser, ...globals.commonjs },
		},
	},

	// React
	{
		files: ['**/*.{js,jsx,ts,tsx}'],
		extends: [
			react.configs.flat.recommended,
			react.configs.flat['jsx-runtime'],
			jsxA11y.flatConfigs.recommended,
		],
		plugins: { 'react-hooks': reactHooks },
		rules: reactHooks.configs.recommended.rules,
		settings: {
			react: { version: 'detect' },
			formComponents: ['Form'],
			linkComponents: [
				{ name: 'Link', linkAttribute: 'to' },
				{ name: 'NavLink', linkAttribute: 'to' },
			],
			'import/resolver': { typescript: {} },
		},
	},

	// Typescript
	{
		files: ['**/*.{ts,tsx}'],
		extends: [
			...tseslint.configs.recommended,
			importPlugin.flatConfigs.recommended,
			importPlugin.flatConfigs.typescript,
		],
		settings: {
			'import/internal-regex': '^~/',
			'import/resolver': {
				node: { extensions: ['.ts', '.tsx'] },
				typescript: { alwaysTryTypes: true },
			},
		},
	},

	// Node
	{
		files: ['eslint.config.js', '*.config.{js,ts}'],
		languageOptions: { globals: globals.node },
	}
)
