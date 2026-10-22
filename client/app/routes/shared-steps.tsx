import { type ActionFunctionArgs } from '@remix-run/node'
import { APIRoute } from '~/utility/Routes'
import { requireAPI } from '~/utility/API.server'
import { Tools } from '~/utility/Tools'

// creates, edits and deletes the shared steps of a project
export async function action({ request }: ActionFunctionArgs) {
	const api = await requireAPI(request)
	try {
		const body = await request.json()
		const sharedStep = { name: body.name, items: body.items }
		switch (body.intent) {
			case 'create':
				await api.post(APIRoute.projectSharedSteps(body.projectShortCode), {
					body: sharedStep,
				})
				break
			case 'update':
				await api.put(APIRoute.sharedStep(body.sharedStepID), {
					body: sharedStep,
				})
				break
			case 'delete':
				await api.delete(APIRoute.sharedStep(body.sharedStepID))
				break
			default:
				throw 'Invalid request'
		}
		return { ok: true }
	} catch (error) {
		return Response.json(Tools.mapErrorToResponse(error), { status: 400 })
	}
}
