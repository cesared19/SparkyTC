import { type ActionFunctionArgs } from '@remix-run/node'
import { APIRoute } from '~/utility/Routes'
import { APIClient } from '~/utility/APIClient'
import { Tools } from '~/utility/Tools'

export async function action({ request, params }: ActionFunctionArgs) {
	try {
		const linkID = params.linkID
		if (!linkID) {
			throw 'Link ID is required'
		}
		if (request.method !== 'DELETE') {
			throw 'Invalid request method'
		}

		await APIClient.delete(APIRoute.jiraLink(linkID))
		return { ok: true }
	} catch (error) {
		return Response.json(Tools.mapErrorToResponse(error), { status: 400 })
	}
}
