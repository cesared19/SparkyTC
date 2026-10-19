import { type LoaderFunctionArgs } from '@remix-run/node'
import { FetchResponse, JiraIssueType } from '~/models/types'
import { requireAdmin } from '~/utility/Authorization.server'
import { APIRoute } from '~/utility/Routes'
import { Tools } from '~/utility/Tools'

// issue types of a Jira space, loaded by the project settings when another space is picked
export async function loader({ request }: LoaderFunctionArgs) {
	const { api } = await requireAdmin(request)
	const projectKey = new URL(request.url).searchParams.get('projectKey')
	if (!projectKey) {
		return { issueTypes: [] as JiraIssueType[] }
	}

	try {
		const response = await api.get<FetchResponse<JiraIssueType[]>>(
			APIRoute.jiraIssueTypes(projectKey)
		)
		return { issueTypes: response.data }
	} catch (error) {
		return {
			issueTypes: [] as JiraIssueType[],
			...Tools.mapErrorToResponse(error),
		}
	}
}
