import { type ActionFunctionArgs } from '@remix-run/node'
import { requireAPI } from '~/utility/API.server'
import { APIRoute } from '~/utility/Routes'
import { Tools } from '~/utility/Tools'

export async function action({ request }: ActionFunctionArgs) {
	const api = await requireAPI(request)
	try {
		const body = await request.json()
		if (body.intent === 'testRunAssignees') {
			await api.put(APIRoute.testRunAssignees(body.testRunID), {
				body: { userIDs: body.userIDs },
			})
		} else if (body.intent === 'testCaseRunAssignee') {
			await api.put(APIRoute.testCaseRunAssignee(body.testCaseRunID), {
				body: { userID: body.userID ?? null },
			})
		} else {
			throw 'Invalid request'
		}
		return { ok: true }
	} catch (error) {
		return Response.json(Tools.mapErrorToResponse(error), { status: 400 })
	}
}
