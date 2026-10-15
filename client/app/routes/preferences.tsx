import { type ActionFunctionArgs } from '@remix-run/node'
import { requireAPI } from '~/utility/API.server'
import { APIRoute } from '~/utility/Routes'
import { Tools } from '~/utility/Tools'

export async function action({ request }: ActionFunctionArgs) {
	const api = await requireAPI(request)
	try {
		const body = await request.json()
		const { intent, theme, projectShortCode } = body
		if (intent === 'theme') {
			await api.put(APIRoute.themePreference, { body: { theme } })
		} else if (intent === 'notifications') {
			const { testRunAssigned, testRunCompleted } = body
			await api.put(APIRoute.notificationPreferences, {
				body: { testRunAssigned, testRunCompleted },
			})
		} else if (intent === 'defaultProject') {
			await api.put(APIRoute.defaultProjectPreference, {
				body: { projectShortCode: projectShortCode ?? null },
			})
		} else {
			throw 'Invalid request'
		}
		return { ok: true }
	} catch (error) {
		return Response.json(Tools.mapErrorToResponse(error), { status: 400 })
	}
}
