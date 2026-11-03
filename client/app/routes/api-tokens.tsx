import { type ActionFunctionArgs } from '@remix-run/node'
import { FetchResponse, ProjectApiToken } from '~/models/types'
import { requireAdmin } from '~/utility/Authorization.server'
import { APIRoute } from '~/utility/Routes'
import { Tools } from '~/utility/Tools'

// creating and revoking project API tokens, admins only
export async function action({ request }: ActionFunctionArgs) {
	const { api } = await requireAdmin(request)
	try {
		const body = await request.json()
		if (body.intent === 'create') {
			const response = await api.post<
				FetchResponse<{ token: ProjectApiToken; secret: string }>
			>(APIRoute.projectApiTokens(body.projectShortCode), {
				body: { name: body.name, canWrite: body.canWrite === true },
			})
			return { ok: true as const, secret: response.data.secret }
		}
		if (body.intent === 'revoke') {
			await api.delete(APIRoute.apiToken(body.tokenID))
			return { ok: true as const }
		}
		throw 'Invalid request'
	} catch (error) {
		return Response.json(Tools.mapErrorToResponse(error), { status: 400 })
	}
}
