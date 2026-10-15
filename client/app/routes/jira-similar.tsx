import { type LoaderFunctionArgs } from '@remix-run/node'
import { FetchResponse, SimilarJiraIssue } from '~/models/types'
import { requireAPI } from '~/utility/API.server'
import { APIRoute } from '~/utility/Routes'
import { Tools } from '~/utility/Tools'

export async function loader({ request }: LoaderFunctionArgs) {
	const api = await requireAPI(request)
	const params = new URL(request.url).searchParams
	const testCaseRunID = params.get('testCaseRunID')
	const summary = params.get('summary')?.trim()
	if (!testCaseRunID || !summary) {
		return { issues: [] as SimilarJiraIssue[] }
	}

	try {
		const response = await api.get<FetchResponse<SimilarJiraIssue[]>>(
			APIRoute.similarJiraIssues(testCaseRunID, summary)
		)
		return { issues: response.data }
	} catch (error) {
		// the suggestion is a convenience, failing to search must not block creating the issue
		return {
			issues: [] as SimilarJiraIssue[],
			...Tools.mapErrorToResponse(error),
		}
	}
}
