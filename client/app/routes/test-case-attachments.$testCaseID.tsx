import { type ActionFunctionArgs } from '@remix-run/node'
import { APIRoute } from '~/utility/Routes'
import { APIClient } from '~/utility/APIClient'
import { Tools } from '~/utility/Tools'

export async function action({ request, params }: ActionFunctionArgs) {
	try {
		const testCaseID = params.testCaseID
		if (!testCaseID) {
			throw 'Test case ID is required'
		}

		const contentType = request.headers.get('Content-Type')
		if (!contentType?.startsWith('multipart/form-data')) {
			throw 'Select at least one image or video to upload'
		}

		// forward the multipart body untouched instead of parsing it here: the File class
		// returned by request.formData() differs between the dev server and remix-serve,
		// and the backend already validates the uploaded files
		await APIClient.postMultipart(
			APIRoute.testCaseAttachments(testCaseID),
			await request.arrayBuffer(),
			contentType
		)
		return { ok: true }
	} catch (error) {
		return Response.json(Tools.mapErrorToResponse(error), { status: 400 })
	}
}
