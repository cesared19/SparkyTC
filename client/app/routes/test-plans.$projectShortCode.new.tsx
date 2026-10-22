import { type ActionFunctionArgs, redirect } from '@remix-run/node'
import {
	useActionData,
	useNavigate,
	useNavigation,
	useOutletContext,
	useSubmit,
} from '@remix-run/react'
import { BackButton } from '~/components/BackButton'
import { TestPlanForm } from '~/components/TestPlanForm'
import {
	ErrorResponse,
	FetchResponse,
	ProjectTestPlansOutletContext,
	TestPlan,
} from '~/models/types'
import { requireAPI } from '~/utility/API.server'
import { APIRoute, Route } from '~/utility/Routes'
import { Tools } from '~/utility/Tools'

export async function action({ request, params }: ActionFunctionArgs) {
	const api = await requireAPI(request)
	try {
		const projectShortCode = params.projectShortCode ?? ''
		const response = await api.post<FetchResponse<TestPlan>>(
			APIRoute.projectTestPlans(projectShortCode),
			{ body: await request.json() }
		)
		return redirect(
			Route.viewTestPlan(projectShortCode, response.data.testPlanID)
		)
	} catch (error) {
		return Response.json(Tools.mapErrorToResponse(error), { status: 400 })
	}
}

export default function NewTestPlan() {
	const { project, testCases, sections } =
		useOutletContext<ProjectTestPlansOutletContext>()
	const navigate = useNavigate()
	const navigation = useNavigation()
	const submit = useSubmit()
	const actionData = useActionData<ErrorResponse>()

	return (
		<div className="space-y-6">
			<BackButton />
			<h2 className="text-2xl font-semibold text-gray-900">New Test Plan</h2>
			<TestPlanForm
				project={project}
				sections={sections}
				testCases={testCases}
				error={actionData?.message}
				isSubmitting={navigation.state !== 'idle'}
				onCancel={() => navigate('..')}
				onSubmit={(plan) =>
					submit(plan, { method: 'post', encType: 'application/json' })
				}
			/>
		</div>
	)
}
