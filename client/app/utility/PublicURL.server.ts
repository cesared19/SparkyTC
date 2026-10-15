/**
 * The URL users reach cherry at, used for links from Jira back to cherry. Defaults to the origin of
 * the current request (e.g. http://192.168.1.20:3000) and can be overridden with CHERRY_PUBLIC_URL.
 */
export function publicBaseURL(request: Request) {
	return process.env.CHERRY_PUBLIC_URL || new URL(request.url).origin
}
