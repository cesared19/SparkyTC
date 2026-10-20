import { type LoaderFunctionArgs } from '@remix-run/node'
import { FetchResponse, JiraTransition } from '~/models/types'
import { requireAPI } from '~/utility/API.server'
import { APIRoute } from '~/utility/Routes'
import { Tools } from '~/utility/Tools'

// the transitions a linked issue can take, to close or reopen it when recording a result
export async function loader({ request }: LoaderFunctionArgs) {
	const api = await requireAPI(request)
	const params = new URL(request.url).searchParams
	try {
		const response = await api.get<FetchResponse<JiraTransition[]>>(
			APIRoute.jiraTransitions(
				params.get('testCaseRunID') ?? '',
				params.get('issueKey') ?? ''
			)
		)
		return { transitions: response.data }
	} catch (error) {
		return {
			transitions: [] as JiraTransition[],
			...Tools.mapErrorToResponse(error),
		}
	}
}
