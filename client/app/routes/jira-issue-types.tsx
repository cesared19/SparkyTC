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
		return {
			issueTypes: [] as JiraIssueType[],
			canModifyReporter: null as boolean | null,
		}
	}

	try {
		const response = await api.get<FetchResponse<JiraIssueType[]>>(
			APIRoute.jiraIssueTypes(projectKey)
		)
		// the reporter check is informative, failing it doesn't hide the issue types
		let canModifyReporter: boolean | null = null
		try {
			canModifyReporter = (
				await api.get<FetchResponse<{ canModifyReporter: boolean }>>(
					APIRoute.jiraReporterPermission(projectKey)
				)
			).data.canModifyReporter
		} catch {
			canModifyReporter = null
		}
		return { issueTypes: response.data, canModifyReporter }
	} catch (error) {
		return {
			issueTypes: [] as JiraIssueType[],
			canModifyReporter: null as boolean | null,
			...Tools.mapErrorToResponse(error),
		}
	}
}
