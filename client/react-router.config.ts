import type { Config } from '@react-router/dev/config'

export default {
	// the app renders on the server, like it did with Remix; the files stay in app/ and build to build/
	ssr: true,
} satisfies Config
