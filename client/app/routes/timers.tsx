import { type ActionFunctionArgs } from '@remix-run/node'
import { requireAPI } from '~/utility/API.server'
import { APIRoute } from '~/utility/Routes'
import { Tools } from '~/utility/Tools'

// starts and pauses test case timers; admins also set a closed test run's total
export async function action({ request }: ActionFunctionArgs) {
	const api = await requireAPI(request)
	try {
		const body = await request.json()
		if (body.intent === 'start' || body.intent === 'pause') {
			await api.post(APIRoute.timer(body.testCaseRunID, body.intent))
		} else if (body.intent === 'total') {
			await api.put(APIRoute.testRunTime(body.testRunID), {
				body: { totalSeconds: body.totalSeconds ?? null },
			})
		} else {
			throw 'Invalid request'
		}
		return { ok: true }
	} catch (error) {
		return Response.json(Tools.mapErrorToResponse(error), { status: 400 })
	}
}
