import {
	type ActionFunctionArgs,
	type LoaderFunctionArgs,
} from '@remix-run/node'
import { FetchResponse, JiraUser } from '~/models/types'
import { requireAPI } from '~/utility/API.server'
import { APIRoute } from '~/utility/Routes'
import { Tools } from '~/utility/Tools'

// Jira users matching a name or email, to link as the reporter of a user's issues
export async function loader({ request }: LoaderFunctionArgs) {
	const api = await requireAPI(request)
	const query = new URL(request.url).searchParams.get('query')?.trim() ?? ''
	if (query.length < 2) {
		return { users: [] as JiraUser[] }
	}

	try {
		const response = await api.get<FetchResponse<JiraUser[]>>(
			APIRoute.jiraUsers(query)
		)
		return { users: response.data }
	} catch (error) {
		return { users: [] as JiraUser[], ...Tools.mapErrorToResponse(error) }
	}
}

// links or unlinks the Jira user, for the signed in user or, for admins, another user
export async function action({ request }: ActionFunctionArgs) {
	const api = await requireAPI(request)
	try {
		const { userID, accountID } = await request.json()
		await api.put(
			userID ? APIRoute.userJiraUser(userID) : APIRoute.ownJiraUser,
			{ body: { accountID: accountID ?? null } }
		)
		return { ok: true }
	} catch (error) {
		return Response.json(Tools.mapErrorToResponse(error), { status: 400 })
	}
}
