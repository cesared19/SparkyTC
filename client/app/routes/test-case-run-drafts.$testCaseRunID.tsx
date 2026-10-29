import {
	type ActionFunctionArgs,
	type LoaderFunctionArgs,
} from '@remix-run/node'
import { APIRoute } from '~/utility/Routes'
import { requireAPI } from '~/utility/API.server'
import { Tools } from '~/utility/Tools'
import { FetchResponse, ResultDraft } from '~/models/types'

// the signed in user's unsaved result for a test case in a run
export async function loader({ request, params }: LoaderFunctionArgs) {
	const api = await requireAPI(request)
	try {
		const response = await api.get<FetchResponse<ResultDraft>>(
			APIRoute.testCaseRunDraft(params.testCaseRunID ?? '')
		)
		return response.data
	} catch (error) {
		return Response.json(Tools.mapErrorToResponse(error), { status: 400 })
	}
}

// PUT keeps the draft, DELETE discards it
export async function action({ request, params }: ActionFunctionArgs) {
	const api = await requireAPI(request)
	try {
		const url = APIRoute.testCaseRunDraft(params.testCaseRunID ?? '')
		if (request.method === 'PUT') {
			const response = await api.put<FetchResponse<ResultDraft>>(url, {
				body: await request.json(),
			})
			return response.data
		}
		if (request.method === 'DELETE') {
			await api.delete(url)
			return { ok: true }
		}
		throw 'Invalid request method'
	} catch (error) {
		return Response.json(Tools.mapErrorToResponse(error), { status: 400 })
	}
}
