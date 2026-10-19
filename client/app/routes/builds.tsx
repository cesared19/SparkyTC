import { type ActionFunctionArgs } from '@remix-run/node'
import { requireAPI } from '~/utility/API.server'
import { APIRoute } from '~/utility/Routes'
import { Tools } from '~/utility/Tools'

// registering and changing builds is limited to admins by the backend
export async function action({ request }: ActionFunctionArgs) {
	const api = await requireAPI(request)
	try {
		const body = await request.json()
		if (body.intent === 'create') {
			await api.post(APIRoute.projectBuilds(body.projectShortCode), {
				body: { buildNumber: body.buildNumber },
			})
		} else if (body.intent === 'update') {
			await api.put(APIRoute.build(body.buildID), {
				body: { buildNumber: body.buildNumber },
			})
		} else if (body.intent === 'delete') {
			await api.delete(APIRoute.build(body.buildID))
		} else if (body.intent === 'testRunBuild') {
			await api.put(APIRoute.testRunBuild(body.testRunID), {
				body: { buildID: body.buildID ?? null },
			})
		} else {
			throw 'Invalid request'
		}
		return { ok: true }
	} catch (error) {
		return Response.json(Tools.mapErrorToResponse(error), { status: 400 })
	}
}
