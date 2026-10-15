import { type ActionFunctionArgs, redirect } from '@remix-run/node'
import { APIClient } from '~/utility/APIClient'
import { APIRoute } from '~/utility/Routes'
import { getSessionToken, sessionStorage } from '~/utility/Session.server'

export async function action({ request }: ActionFunctionArgs) {
	const token = await getSessionToken(request)
	if (token) {
		// end the session in the backend too, ignoring failures since the cookie is cleared anyway
		await APIClient.post(APIRoute.logout, {
			headers: { Authorization: `Bearer ${token}` },
		}).catch(() => undefined)
	}

	const session = await sessionStorage.getSession(request.headers.get('Cookie'))
	return redirect('/login', {
		headers: { 'Set-Cookie': await sessionStorage.destroySession(session) },
	})
}

export async function loader() {
	return redirect('/')
}
