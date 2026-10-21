import { type LoaderFunctionArgs } from '@remix-run/node'
import { FetchResponse, TestCaseHistoryEntry } from '~/models/types'
import { APIRoute } from '~/utility/Routes'
import { requireAPI } from '~/utility/API.server'
import { Tools } from '~/utility/Tools'

// every result of a test case in the runs of its project, newest first
export async function loader({ request, params }: LoaderFunctionArgs) {
	const api = await requireAPI(request)
	try {
		const response = await api.get<FetchResponse<TestCaseHistoryEntry[]>>(
			APIRoute.testCaseHistory(params.testCaseID ?? '')
		)
		return { history: response.data }
	} catch (error) {
		return {
			history: [] as TestCaseHistoryEntry[],
			...Tools.mapErrorToResponse(error),
		}
	}
}
