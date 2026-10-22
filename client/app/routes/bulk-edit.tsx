import { type ActionFunctionArgs } from '@remix-run/node'
import { requireAPI } from '~/utility/API.server'
import { APIRoute } from '~/utility/Routes'
import { Tools } from '~/utility/Tools'
import { BulkEditResult, FetchResponse } from '~/models/types'

// changes many test cases at once, or assigns many test cases of a run
export async function action({ request }: ActionFunctionArgs) {
	const api = await requireAPI(request)
	try {
		const { intent, ...body } = await request.json()
		let response: FetchResponse<BulkEditResult>
		switch (intent) {
			case 'edit':
				response = await api.put<FetchResponse<BulkEditResult>>(
					APIRoute.bulkEditTestCases,
					{ body }
				)
				break
			case 'delete':
				response = await api.post<FetchResponse<BulkEditResult>>(
					APIRoute.bulkDeleteTestCases,
					{ body }
				)
				break
			case 'assign':
				response = await api.put<FetchResponse<BulkEditResult>>(
					APIRoute.bulkAssignTestCaseRuns,
					{ body }
				)
				break
			default:
				throw 'Invalid request'
		}
		return { ok: true, intent, result: response.data }
	} catch (error) {
		return Response.json(Tools.mapErrorToResponse(error), { status: 400 })
	}
}
