import { ActionFunctionArgs, redirect } from '@remix-run/node'
import {
	useNavigate,
	useSubmit,
	useOutletContext,
	useActionData,
	useSearchParams,
} from '@remix-run/react'
import { APIRoute, Route } from '~/utility/Routes'
import { TestCaseForm, TestCaseFormMode } from '~/components/TestCaseForm'
import { ProjectTestCasesOutletContext, ErrorResponse } from '~/models/types'
import { requireAPI } from '~/utility/API.server'
import { Tools } from '~/utility/Tools'

export async function action({ request, params }: ActionFunctionArgs) {
	const api = await requireAPI(request)
	try {
		const projectShortCode = params.projectShortCode
		if (!projectShortCode) {
			throw 'Project short code is required'
		}

		await api.post(APIRoute.projectTestCases(projectShortCode), {
			body: await request.json(),
		})
		return redirect(
			`${Route.viewProjectTestCases(projectShortCode)}${
				new URL(request.url).search
			}`
		)
	} catch (error) {
		return Response.json(Tools.mapErrorToResponse(error), { status: 400 })
	}
}

export default function NewTestCase() {
	const { properties, sections } =
		useOutletContext<ProjectTestCasesOutletContext>()
	const [searchParams] = useSearchParams()
	const navigate = useNavigate()
	const submit = useSubmit()
	const actionData = useActionData<ErrorResponse>()

	return (
		<div>
			<div className="mb-6 flex items-center justify-between">
				<h2 className="text-2xl font-semibold text-gray-900">New Test Case</h2>
			</div>
			<div className="rounded-lg border-gray-200 bg-white">
				<TestCaseForm
					properties={properties}
					sections={sections}
					defaultSectionID={searchParams.get('section') ?? undefined}
					mode={TestCaseFormMode.create}
					onCancel={() => navigate('..')}
					onSubmit={(testCase) => {
						submit(testCase, {
							method: 'POST',
							encType: 'application/json',
						})
					}}
					error={actionData?.message}
				/>
			</div>
		</div>
	)
}
