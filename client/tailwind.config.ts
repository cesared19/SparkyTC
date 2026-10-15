import type { Config } from 'tailwindcss'

// the gray scale is driven by CSS variables so dark mode can swap it in one place (see tailwind.css)
const gray = Object.fromEntries(
	[50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950].map((step) => [
		step,
		`rgb(var(--color-gray-${step}) / <alpha-value>)`,
	])
)

// brand palette from the SparkPlug logo: crimson #C01C37 at step 600, driven by CSS variables so
// dark mode can lighten text and tinted backgrounds (see tailwind.css)
const brand = Object.fromEntries(
	[50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950].map((step) => [
		step,
		`rgb(var(--color-brand-${step}) / <alpha-value>)`,
	])
)

export default {
	content: ['./app/**/{**,.client,.server}/**/*.{js,jsx,ts,tsx}'],
	darkMode: 'class',
	theme: {
		extend: {
			colors: { gray, brand },
			fontFamily: {
				sans: [
					'Inter',
					'ui-sans-serif',
					'system-ui',
					'sans-serif',
					'Apple Color Emoji',
					'Segoe UI Emoji',
					'Segoe UI Symbol',
					'Noto Color Emoji',
				],
			},
		},
	},
	plugins: [],
} satisfies Config
