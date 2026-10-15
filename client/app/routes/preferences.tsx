import { type ActionFunctionArgs } from '@remix-run/node'
import { requireAPI } from '~/utility/API.server'
import { APIRoute } from '~/utility/Routes'
import { Tools } from '~/utility/Tools'

export async function action({ request }: ActionFunctionArgs) {
	const api = await requireAPI(request)
	try {
		const { intent, theme, projectShortCode } = await request.json()
		if (intent === 'theme') {
			await api.put(APIRoute.themePreference, { body: { theme } })
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
