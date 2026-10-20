import { type LoaderFunctionArgs } from '@remix-run/node'
import { FetchResponse, JiraUser } from '~/models/types'
import { requireAPI } from '~/utility/API.server'
import { APIRoute } from '~/utility/Routes'
import { Tools } from '~/utility/Tools'

// Jira users a linked issue can be assigned to, matching a name or email
export async function loader({ request }: LoaderFunctionArgs) {
	const api = await requireAPI(request)
	const params = new URL(request.url).searchParams
	const query = params.get('query')?.trim() ?? ''
	if (query.length < 2) {
		return { users: [] as JiraUser[] }
	}

	try {
		const response = await api.get<FetchResponse<JiraUser[]>>(
			APIRoute.jiraAssignableUsers(
				params.get('testCaseRunID') ?? '',
				params.get('issueKey') ?? '',
				query
			)
		)
		return { users: response.data }
	} catch (error) {
		return { users: [] as JiraUser[], ...Tools.mapErrorToResponse(error) }
	}
}
