import { type ActionFunctionArgs, redirect, json } from '@remix-run/node'
import {
	useActionData,
	useNavigate,
	useOutletContext,
	useSubmit,
} from '@remix-run/react'
import { APIRoute, Route } from '~/utility/Routes'
import { TestCaseForm, TestCaseFormMode } from '~/components/TestCaseForm'
import {
	CreateTestCase,
	ErrorResponse,
	TestCaseOutletContext,
} from '~/models/types'
import { requireAPI } from '~/utility/API.server'
import { Tools } from '~/utility/Tools'
import { AttachmentGallery } from '~/components/AttachmentGallery'
import { useIsAdmin } from '~/utility/CurrentUser'

export async function action({ request, params }: ActionFunctionArgs) {
	const api = await requireAPI(request)
	try {
		const projectShortCode = params.projectShortCode
		const testCaseNumber = Number(params.testCaseNumber)
		if (!projectShortCode) {
			throw 'Project short code is required'
		}
		if (!testCaseNumber) {
			throw 'Test case number is required'
		}

		if (request.method === 'DELETE') {
			const { testCaseID } = await request.json()
			await api.delete(APIRoute.testCase(testCaseID))
			return redirect(Route.viewProjectTestCases(projectShortCode))
		} else if (request.method === 'PUT') {
			const { testCaseID, testCaseUpdate } = await request.json()
			await api.put(APIRoute.testCase(testCaseID), {
				body: testCaseUpdate,
			})
			return redirect(Route.viewTestCase(projectShortCode, testCaseNumber))
		} else {
			throw 'Invalid request method'
		}
	} catch (error) {
		return Response.json(Tools.mapErrorToResponse(error), { status: 400 })
	}
}

export default function EditTestCase() {
	const navigate = useNavigate()
	const submit = useSubmit()
	const { testCase, properties, sections } =
		useOutletContext<TestCaseOutletContext>()
	const actionData = useActionData<ErrorResponse>()
	const isAdmin = useIsAdmin()

	function handleSubmit(testCaseUpdate: CreateTestCase) {
		submit(
			{
				testCaseID: testCase.testCaseID,
				testCaseUpdate,
			},
			{
				method: 'PUT',
				encType: 'application/json',
			}
		)
	}

	async function handleDelete() {
		if (
			confirm(
				'Are you sure you want to delete this test case? If it was used in test runs it is archived instead, and those runs keep its results.'
			)
		) {
			submit(
				{ testCaseID: testCase.testCaseID },
				{ method: 'DELETE', encType: 'application/json' }
			)
		}
	}

	return (
		<div>
			<div className="mb-6">
				<h2 className="text-2xl font-semibold text-gray-900">Edit Test Case</h2>
			</div>

			<TestCaseForm
				properties={properties}
				sections={sections}
				defaultValues={testCase}
				mode={TestCaseFormMode.edit}
				onCancel={() => navigate('..')}
				onSubmit={handleSubmit}
				error={actionData?.message}
				// deleting test cases is restricted to admins
				onDelete={isAdmin ? handleDelete : undefined}
			/>

			<div className="mt-8 border-t border-gray-200 pt-6">
				<h3 className="mb-2 text-base font-semibold text-gray-700">
					Images and Videos
				</h3>
				<p className="mb-3 text-xs text-gray-500">
					Attachments are saved immediately and are shown when the test case is
					opened during a test run
				</p>
				<AttachmentGallery
					testCaseID={testCase.testCaseID}
					attachments={testCase.attachments ?? []}
					editable
				/>
			</div>
		</div>
	)
}
