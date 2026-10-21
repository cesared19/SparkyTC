import { type ActionFunctionArgs } from '@remix-run/node'
import { APIRoute } from '~/utility/Routes'
import { requireAPI } from '~/utility/API.server'
import { Tools } from '~/utility/Tools'

// admins delete a result recorded by mistake
export async function action({ request, params }: ActionFunctionArgs) {
	const api = await requireAPI(request)
	try {
		const resultID = params.resultID
		if (!resultID) {
			throw 'Result ID is required'
		}
		if (request.method !== 'DELETE') {
			throw 'Invalid request method'
		}

		await api.delete(APIRoute.testCaseResult(resultID))
		return { ok: true }
	} catch (error) {
		return Response.json(Tools.mapErrorToResponse(error), { status: 400 })
	}
}
