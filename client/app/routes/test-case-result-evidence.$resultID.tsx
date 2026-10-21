import { type ActionFunctionArgs } from '@remix-run/node'
import { APIRoute } from '~/utility/Routes'
import { requireAPI } from '~/utility/API.server'
import { Tools } from '~/utility/Tools'

// adds images or videos as the evidence of a result
export async function action({ request, params }: ActionFunctionArgs) {
	const api = await requireAPI(request)
	try {
		const resultID = params.resultID
		if (!resultID) {
			throw 'Result ID is required'
		}

		const contentType = request.headers.get('Content-Type')
		if (!contentType?.startsWith('multipart/form-data')) {
			throw 'Select at least one image or video to upload'
		}

		// forwarded untouched, like the test case attachments
		await api.postMultipart(
			APIRoute.resultEvidence(resultID),
			await request.arrayBuffer(),
			contentType
		)
		return { ok: true }
	} catch (error) {
		return Response.json(Tools.mapErrorToResponse(error), { status: 400 })
	}
}
