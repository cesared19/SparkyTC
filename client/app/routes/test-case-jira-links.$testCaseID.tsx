import { type ActionFunctionArgs } from '@remix-run/node'
import { APIRoute } from '~/utility/Routes'
import { APIClient } from '~/utility/APIClient'
import { Tools } from '~/utility/Tools'
import { publicBaseURL } from '~/utility/PublicURL.server'

export async function action({ request, params }: ActionFunctionArgs) {
	try {
		const testCaseID = params.testCaseID
		if (!testCaseID) {
			throw 'Test case ID is required'
		}

		const { issue } = (await request.json()) as { issue: string }
		await APIClient.post(APIRoute.testCaseJiraLinks(testCaseID), {
			body: { issue, cherryBaseURL: publicBaseURL(request) },
		})
		return { ok: true }
	} catch (error) {
		return Response.json(Tools.mapErrorToResponse(error), { status: 400 })
	}
}
