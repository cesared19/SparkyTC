import { useEffect, useState } from 'react'

/**
 * Whether the media query matches, for layouts that can't just hide one version with CSS (e.g. forms
 * whose fields would be submitted twice). The server renders the fallback.
 */
export function useMediaQuery(query: string, fallback: boolean) {
	const [matches, setMatches] = useState(fallback)

	useEffect(() => {
		const media = window.matchMedia(query)
		const update = () => setMatches(media.matches)
		update()
		media.addEventListener('change', update)
		return () => media.removeEventListener('change', update)
	}, [query])

	return matches
}
