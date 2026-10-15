import { type LoaderFunctionArgs } from '@remix-run/node'
import { APIRoute } from '~/utility/Routes'
import { APIClient } from '~/utility/APIClient'
import { FetchResponse, JiraConfiguration, JiraIssue } from '~/models/types'
import { Tools } from '~/utility/Tools'

export async function loader({ request }: LoaderFunctionArgs) {
	try {
		const keys = new URL(request.url).searchParams.getAll('keys')

		const configuration = await APIClient.get<FetchResponse<JiraConfiguration>>(
			APIRoute.jiraConfiguration
		)

		let issues: JiraIssue[] = []
		if (configuration.data.isEnabled && keys.length > 0) {
			const response = await APIClient.get<FetchResponse<JiraIssue[]>>(
				APIRoute.jiraIssues(keys)
			)
			issues = response.data
		}

		return { configuration: configuration.data, issues }
	} catch (error) {
		return Response.json(Tools.mapErrorToResponse(error), { status: 400 })
	}
}
