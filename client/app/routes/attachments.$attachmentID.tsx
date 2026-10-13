import {
	type ActionFunctionArgs,
	type LoaderFunctionArgs,
} from '@remix-run/node'
import { APIRoute } from '~/utility/Routes'
import { APIClient } from '~/utility/APIClient'
import { Tools } from '~/utility/Tools'

// headers forwarded from the backend so browsers can render and seek through media
const FORWARDED_HEADERS = [
	'Content-Type',
	'Content-Length',
	'Content-Range',
	'Accept-Ranges',
	'Content-Disposition',
]

export async function loader({ request, params }: LoaderFunctionArgs) {
	const attachmentID = params.attachmentID
	if (!attachmentID) {
		throw new Response('Attachment ID is required', { status: 400 })
	}

	const headers: Record<string, string> = {}
	const range = request.headers.get('Range')
	if (range) {
		headers['Range'] = range
	}

	const response = await fetch(APIRoute.attachment(attachmentID), {
		headers,
	})
	if (!response.ok) {
		throw new Response('Attachment not found', { status: 404 })
	}

	const responseHeaders = new Headers()
	for (const header of FORWARDED_HEADERS) {
		const value = response.headers.get(header)
		if (value) {
			responseHeaders.set(header, value)
		}
	}
	responseHeaders.set('Cache-Control', 'private, max-age=3600')

	return new Response(response.body, {
		status: response.status,
		headers: responseHeaders,
	})
}

export async function action({ request, params }: ActionFunctionArgs) {
	try {
		const attachmentID = params.attachmentID
		if (!attachmentID) {
			throw 'Attachment ID is required'
		}
		if (request.method !== 'DELETE') {
			throw 'Invalid request method'
		}

		await APIClient.delete(APIRoute.attachment(attachmentID))
		return { ok: true }
	} catch (error) {
		return Response.json(Tools.mapErrorToResponse(error), { status: 400 })
	}
}
