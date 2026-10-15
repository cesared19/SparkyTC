import { APIClient, UnauthorizedError } from './APIClient'
import { getSessionToken, redirectToLogin } from './Session.server'

interface RequestOptions {
	body?: unknown
	headers?: Record<string, string>
}

/**
 * API client bound to the signed in user's session. Any request rejected by the backend as
 * unauthorized (e.g. an expired session) redirects the user to the login page.
 */
export class AuthenticatedAPI {
	constructor(private request: Request, private token: string) {}

	private headers(options?: RequestOptions) {
		return {
			...options,
			headers: { ...options?.headers, Authorization: `Bearer ${this.token}` },
		}
	}

	private async handle<T>(call: () => Promise<T>): Promise<T> {
		try {
			return await call()
		} catch (error) {
			if (error instanceof UnauthorizedError) {
				throw await redirectToLogin(this.request)
			}
			throw error
		}
	}

	get<T>(url: string, options?: RequestOptions) {
		return this.handle(() => APIClient.get<T>(url, this.headers(options)))
	}

	post<T>(url: string, options?: RequestOptions) {
		return this.handle(() => APIClient.post<T>(url, this.headers(options)))
	}

	put<T>(url: string, options?: RequestOptions) {
		return this.handle(() => APIClient.put<T>(url, this.headers(options)))
	}

	delete<T>(url: string, options?: RequestOptions) {
		return this.handle(() => APIClient.delete<T>(url, this.headers(options)))
	}

	postMultipart<T>(url: string, body: ArrayBuffer, contentType: string) {
		return this.handle(() =>
			APIClient.postMultipart<T>(url, body, contentType, this.token)
		)
	}

	/** Performs a request and returns the raw response, for binary downloads. */
	async fetch(url: string, init?: RequestInit) {
		const response = await fetch(url, {
			...init,
			headers: {
				...(init?.headers as Record<string, string>),
				Authorization: `Bearer ${this.token}`,
			},
		})
		if (response.status === 401) {
			throw await redirectToLogin(this.request)
		}
		return response
	}

	async postWithResponse(url: string, options?: RequestOptions) {
		return this.fetch(url, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: options?.body ? JSON.stringify(options.body) : undefined,
		})
	}
}

/** Returns an API client for the signed in user, or redirects to the login page. */
export async function requireAPI(request: Request) {
	const token = await getSessionToken(request)
	if (!token) {
		throw await redirectToLogin(request)
	}
	return new AuthenticatedAPI(request, token)
}
