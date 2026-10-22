import { type ActionFunctionArgs } from '@remix-run/node'
import { APIRoute } from '~/utility/Routes'
import { requireAPI } from '~/utility/API.server'
import { Tools } from '~/utility/Tools'

// creates, renames, moves, reorders and deletes suites and sections, and moves test cases between them
export async function action({ request }: ActionFunctionArgs) {
	const api = await requireAPI(request)
	try {
		const body = await request.json()
		switch (body.intent) {
			case 'create':
				await api.post(APIRoute.projectSections(body.projectShortCode), {
					body: { name: body.name, parentID: body.parentID ?? null },
				})
				break
			case 'update':
				await api.put(APIRoute.section(body.sectionID), {
					body: { name: body.name, parentID: body.parentID ?? null },
				})
				break
			case 'reorder':
				await api.post(APIRoute.reorderSection(body.sectionID), {
					body: { direction: body.direction },
				})
				break
			case 'delete':
				await api.delete(APIRoute.section(body.sectionID))
				break
			case 'moveTestCases':
				await api.put(APIRoute.moveTestCases, {
					body: { testCaseIDs: body.testCaseIDs, sectionID: body.sectionID },
				})
				break
			default:
				throw 'Invalid request'
		}
		return { ok: true }
	} catch (error) {
		return Response.json(Tools.mapErrorToResponse(error), { status: 400 })
	}
}
