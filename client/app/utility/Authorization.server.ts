import { FetchResponse, User, UserRole } from '~/models/types'
import { requireAPI } from './API.server'
import { APIRoute } from './Routes'

/** Returns the signed in user, redirecting to the login page when there is no session. */
export async function requireUser(request: Request) {
	const api = await requireAPI(request)
	const response = await api.get<FetchResponse<User>>(APIRoute.currentUser)
	return { api, user: response.data }
}

/** Like requireUser, but responds with 403 when the user isn't an admin. */
export async function requireAdmin(request: Request) {
	const result = await requireUser(request)
	if (result.user.role !== UserRole.admin) {
		throw new Response('Only admins can access this page', { status: 403 })
	}
	return result
}
