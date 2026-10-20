import { createCookieSessionStorage, redirect } from '@remix-run/node'
import { randomBytes } from 'node:crypto'

const SESSION_DURATION_SECONDS = 7 * 24 * 60 * 60

function sessionSecret() {
	if (process.env.SESSION_SECRET) {
		return process.env.SESSION_SECRET
	}
	// without a configured secret every restart signs everyone out, but sessions are still safe
	console.warn(
		'SESSION_SECRET is not set, using a random secret. Users will be signed out whenever the client service restarts.'
	)
	return randomBytes(32).toString('hex')
}

export const sessionStorage = createCookieSessionStorage({
	cookie: {
		name: '__session',
		httpOnly: true,
		sameSite: 'lax',
		path: '/',
		maxAge: SESSION_DURATION_SECONDS,
		// SparkyTC is served over plain http on the local network by default, enable once https is set up
		secure: process.env.COOKIE_SECURE === 'true',
		secrets: [sessionSecret()],
	},
})

export async function getSessionToken(request: Request) {
	const session = await sessionStorage.getSession(request.headers.get('Cookie'))
	return session.get('token') as string | undefined
}

export async function createUserSession(token: string, redirectTo: string) {
	const session = await sessionStorage.getSession()
	session.set('token', token)
	return redirect(redirectTo, {
		headers: { 'Set-Cookie': await sessionStorage.commitSession(session) },
	})
}

// routes without a page, that only answer fetchers, form posts or downloads. Signing in and landing on
// one shows a blank page, e.g. when the session expires while the notification bell refreshes.
// Add new resource routes here.
const RESOURCE_ROUTES = [
	/^\/(assignments|builds|jira-issue-types|jira-issues|jira-similar|jira-users|logout|notifications|preferences|timers)$/,
	/^\/(attachments|jira-links|test-case-attachments|test-case-jira-links)\//,
]

function isPagePath(path: string) {
	const pathname = path.split(/[?#]/)[0]
	return !RESOURCE_ROUTES.some((pattern) => pattern.test(pathname))
}

/** Redirects to the login page, clearing the session cookie. */
export async function redirectToLogin(request: Request) {
	const session = await sessionStorage.getSession(request.headers.get('Cookie'))
	const url = new URL(request.url)
	// data requests (.data) are sent by the client router, send the user back to the page itself
	const path = url.pathname.replace(/\.data$/, '') || '/'
	const params = new URLSearchParams()
	if (path !== '/' && path !== '/login' && isPagePath(path)) {
		params.set('redirectTo', path)
	}
	const query = params.toString()
	return redirect(`/login${query ? `?${query}` : ''}`, {
		headers: { 'Set-Cookie': await sessionStorage.destroySession(session) },
	})
}

/** Only allows redirects to paths within SparkyTC after signing in. */
export function safeRedirect(
	to: FormDataEntryValue | string | null | undefined
) {
	if (
		!to ||
		typeof to !== 'string' ||
		!to.startsWith('/') ||
		to.startsWith('//') ||
		!isPagePath(to)
	) {
		return '/'
	}
	return to
}
