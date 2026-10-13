import { Fragment } from 'react'

// matches http(s) URLs and bare www. URLs, only these schemes are ever turned into links
const URL_PATTERN = /(https?:\/\/[^\s<>"']+|www\.[^\s<>"']+)/gi
const TRAILING_PUNCTUATION = /[.,;:!?'"]+$/

interface LinkifiedTextProps {
	text: string
	className?: string
}

function splitTrailingCharacters(url: string): [string, string] {
	let trimmed = url.replace(TRAILING_PUNCTUATION, '')
	// drop a closing parenthesis that isn't part of the URL, e.g. "(see https://example.com)"
	while (
		trimmed.endsWith(')') &&
		(trimmed.match(/\(/g)?.length ?? 0) < (trimmed.match(/\)/g)?.length ?? 0)
	) {
		trimmed = trimmed.slice(0, -1).replace(TRAILING_PUNCTUATION, '')
	}
	return [trimmed, url.slice(trimmed.length)]
}

/**
 * Renders plain text while turning any URLs into clickable links that open in a new tab,
 * so testers can follow them without losing their place in a test run.
 */
export function LinkifiedText({ text, className }: LinkifiedTextProps) {
	const parts = text.split(URL_PATTERN)

	return (
		<span className={className}>
			{parts.map((part, index) => {
				// split() with a capture group places the matches at odd indexes
				if (index % 2 === 0) {
					return <Fragment key={index}>{part}</Fragment>
				}

				const [url, trailing] = splitTrailingCharacters(part)
				const href = url.toLowerCase().startsWith('www.')
					? `https://${url}`
					: url

				return (
					<Fragment key={index}>
						<a
							href={href}
							target="_blank"
							rel="noopener noreferrer"
							className="text-sky-600 underline break-all hover:text-sky-800"
						>
							{url}
						</a>
						{trailing}
					</Fragment>
				)
			})}
		</span>
	)
}
