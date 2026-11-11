import type { ActionFunctionArgs, LoaderFunctionArgs } from '@remix-run/node'

/**
 * Forwards the integration API (/api/integration/v1/...) to the backend, which is only published on the server
 * itself, so apps on other machines (e.g. re-Play on a tester's PC) reach it on the app's port with their project
 * token. Only this API is forwarded; the app's own backend API stays private. The app's session isn't involved:
 * the cookie isn't sent, and requests without a token get the backend's 401.
 */
const PREFIX = '/api/integration/v1/'

// what the API reads from the request; anything else (the session cookie included) stays here
const REQUEST_HEADERS = ['authorization', 'content-type', 'accept']
// what the API answers with, e.g. JSON and its errors
const RESPONSE_HEADERS = [
	'content-type',
	'content-length',
	'content-disposition',
	'x-content-type-options',
]

function jsonError(status: number, error: string, message: string) {
	return Response.json({ error, message }, { status })
}

async function forward(request: Request) {
	const base = process.env.VITE_API_URL
	if (!base) {
		return jsonError(
			502,
			'Bad Gateway',
			'The app has no backend address (VITE_API_URL)'
		)
	}

	// the incoming path is already normalized; checking the resolved target too keeps "..", "%2e%2e" and the like
	// from ever reaching anything but the integration API
	const incoming = new URL(request.url)
	const target = new URL(incoming.pathname + incoming.search, base)
	if (
		!incoming.pathname.startsWith(PREFIX) ||
		!target.pathname.startsWith(PREFIX) ||
		/%2f|%5c/i.test(incoming.pathname)
	) {
		return jsonError(404, 'Not Found', 'No such integration API endpoint')
	}

	const headers = new Headers()
	for (const name of REQUEST_HEADERS) {
		const value = request.headers.get(name)
		if (value) headers.set(name, value)
	}

	const hasBody = request.method !== 'GET' && request.method !== 'HEAD'
	let response: Response
	try {
		response = await fetch(target, {
			method: request.method,
			headers,
			// streamed both ways, so evidence uploads and large answers aren't held in memory
			body: hasBody ? request.body : undefined,
			// required by Node to send a streamed body
			...(hasBody ? { duplex: 'half' } : {}),
			redirect: 'manual',
			signal: request.signal,
		} as RequestInit)
	} catch (error) {
		if (request.signal.aborted) throw error
		return jsonError(
			502,
			'Bad Gateway',
			"SparkyTC's backend didn't answer. Try again in a moment."
		)
	}

	const responseHeaders = new Headers()
	for (const name of RESPONSE_HEADERS) {
		const value = response.headers.get(name)
		if (value) responseHeaders.set(name, value)
	}
	responseHeaders.set('Cache-Control', 'no-store')
	return new Response(response.body, {
		status: response.status,
		headers: responseHeaders,
	})
}

export const loader = ({ request }: LoaderFunctionArgs) => forward(request)

export const action = ({ request }: ActionFunctionArgs) => forward(request)
