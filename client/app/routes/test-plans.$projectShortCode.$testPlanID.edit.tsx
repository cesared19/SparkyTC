import { type ActionFunctionArgs, redirect } from '@remix-run/node'
import {
	useActionData,
	useNavigate,
	useNavigation,
	useOutletContext,
	useParams,
	useSubmit,
} from '@remix-run/react'
import { BackButton } from '~/components/BackButton'
import { TestPlanForm } from '~/components/TestPlanForm'
import { ErrorResponse, ProjectTestPlansOutletContext } from '~/models/types'
import { requireAPI } from '~/utility/API.server'
import { APIRoute, Route } from '~/utility/Routes'
import { Tools } from '~/utility/Tools'

export async function action({ request, params }: ActionFunctionArgs) {
	const api = await requireAPI(request)
	try {
		const testPlanID = params.testPlanID ?? ''
		await api.put(APIRoute.testPlan(testPlanID), {
			body: await request.json(),
		})
		return redirect(
			Route.viewTestPlan(params.projectShortCode ?? '', testPlanID)
		)
	} catch (error) {
		return Response.json(Tools.mapErrorToResponse(error), { status: 400 })
	}
}

export default function EditTestPlan() {
	const { project, testPlans, testCases, sections } =
		useOutletContext<ProjectTestPlansOutletContext>()
	const { testPlanID } = useParams()
	const navigate = useNavigate()
	const navigation = useNavigation()
	const submit = useSubmit()
	const actionData = useActionData<ErrorResponse>()
	const plan = testPlans.find((plan) => plan.testPlanID === testPlanID)
	if (!plan) return <p>Test plan not found</p>

	return (
		<div className="space-y-6">
			<BackButton />
			<h2 className="text-2xl font-semibold text-gray-900">Edit Test Plan</h2>
			<TestPlanForm
				project={project}
				sections={sections}
				testCases={testCases}
				defaultValues={plan}
				error={actionData?.message}
				isSubmitting={navigation.state !== 'idle'}
				onCancel={() => navigate('..')}
				onSubmit={(update) =>
					submit(update, { method: 'post', encType: 'application/json' })
				}
			/>
		</div>
	)
}
