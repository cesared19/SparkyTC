import type { ErrorResponse } from '~/models/types'

export class UnauthorizedError extends Error {}

/**
 * fetch that reports connection failures (backend stopped, wrong VITE_API_URL) with a clear
 * message instead of the generic "fetch failed".
 */
export async function fetchBackend(url: string, init?: RequestInit) {
	try {
		return await fetch(url, init)
	} catch (error) {
		const origin = URL.canParse(url) ? new URL(url).origin : url
		console.error(`Unable to reach the backend service at ${origin}`, error)
		throw new Error(
			`Unable to reach the SparkyTC backend service (${origin}). Check that it is running and that VITE_API_URL points to it.`
		)
	}
}

interface RequestOptions {
	body?: unknown
	headers?: Record<string, string>
}

export class APIClient {
	private static async request(
		url: string,
		method: string,
		options?: RequestOptions
	): Promise<Response> {
		return fetchBackend(url, {
			method,
			headers: {
				'Content-Type': 'application/json',
				...options?.headers,
			},
			body: options?.body ? JSON.stringify(options.body) : undefined,
		})
	}

	private static async requestJSON<T>(
		url: string,
		method: string,
		options?: RequestOptions
	): Promise<T> {
		const response = await this.request(url, method, options)
		return this.parseJSONResponse<T>(response, method)
	}

	private static async parseJSONResponse<T>(
		response: Response,
		method: string
	): Promise<T> {
		if (response.status === 401) {
			throw new UnauthorizedError('Your session has expired, sign in again')
		}

		const data = await response.json()

		if (!response.ok || data.status === 'ERROR') {
			const errorResponse = data as ErrorResponse
			throw new Error(
				errorResponse.message || `Failed to ${method.toLowerCase()} resource`
			)
		}

		if (data.status !== 'SUCCESS') {
			throw new Error(`Received unknown status: ${data.status}`)
		}

		return data
	}

	static async get<T>(url: string, options?: RequestOptions): Promise<T> {
		return this.requestJSON<T>(url, 'GET', options)
	}

	static async post<T>(url: string, options?: RequestOptions): Promise<T> {
		return this.requestJSON<T>(url, 'POST', options)
	}

	static async postWithResponse(
		url: string,
		options?: RequestOptions
	): Promise<Response> {
		return this.request(url, 'POST', options)
	}

	static async postMultipart<T>(
		url: string,
		body: ArrayBuffer,
		contentType: string,
		token: string
	): Promise<T> {
		// the original content type is forwarded as is, since it carries the multipart boundary
		const response = await fetchBackend(url, {
			method: 'POST',
			headers: {
				'Content-Type': contentType,
				Authorization: `Bearer ${token}`,
			},
			body,
		})
		return this.parseJSONResponse<T>(response, 'POST')
	}

	static async put<T>(url: string, options?: RequestOptions): Promise<T> {
		return this.requestJSON<T>(url, 'PUT', options)
	}

	static async delete<T>(url: string, options?: RequestOptions): Promise<T> {
		return this.requestJSON<T>(url, 'DELETE', options)
	}
}
