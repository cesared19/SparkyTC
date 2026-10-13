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

		const formData = await request.formData()
		const files = formData
			.getAll('files')
			.filter((file): file is File => file instanceof File && file.size > 0)
		if (files.length === 0) {
			throw 'Select at least one image or video to upload'
		}

		const unsupportedFile = files.find(
			(file) =>
				!file.type.startsWith('image/') && !file.type.startsWith('video/')
		)
		if (unsupportedFile) {
			throw `Unsupported file type for ${unsupportedFile.name}, only images and videos are allowed`
		}

		const upstreamFormData = new FormData()
		for (const file of files) {
			upstreamFormData.append('files', file, file.name)
		}

		await APIClient.postFormData(
			APIRoute.testCaseAttachments(testCaseID),
			upstreamFormData
		)
		return { ok: true }
	} catch (error) {
		return Response.json(Tools.mapErrorToResponse(error), { status: 400 })
	}
}
