/**
 * The URL users reach SparkyTC at, used for links from Jira back to SparkyTC. Defaults to the origin of
 * the current request (e.g. http://192.168.1.20:3000) and can be overridden with SPARKYTC_PUBLIC_URL.
 */
export function publicBaseURL(request: Request) {
	return process.env.SPARKYTC_PUBLIC_URL || new URL(request.url).origin
}
