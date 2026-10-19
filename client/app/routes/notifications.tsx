import {
	type ActionFunctionArgs,
	type LoaderFunctionArgs,
} from '@remix-run/node'
import { FetchResponse, NotificationList } from '~/models/types'
import { requireAPI } from '~/utility/API.server'
import { APIRoute } from '~/utility/Routes'
import { Tools } from '~/utility/Tools'

export async function loader({ request }: LoaderFunctionArgs) {
	const api = await requireAPI(request)
	const response = await api.get<FetchResponse<NotificationList>>(
		APIRoute.notifications
	)
	return response.data
}

export async function action({ request }: ActionFunctionArgs) {
	const api = await requireAPI(request)
	try {
		const { intent, notificationID } = await request.json()
		if (intent === 'read') {
			await api.put(APIRoute.notificationRead(notificationID))
		} else if (intent === 'readAll') {
			await api.put(APIRoute.notificationsReadAll)
		} else if (intent === 'delete') {
			await api.delete(APIRoute.notification(notificationID))
		} else if (intent === 'deleteRead') {
			await api.delete(APIRoute.notificationsRead)
		} else {
			throw 'Invalid request'
		}
		return { ok: true }
	} catch (error) {
		return Response.json(Tools.mapErrorToResponse(error), { status: 400 })
	}
}
