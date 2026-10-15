import { json, type ActionFunctionArgs, redirect } from '@remix-run/node'
import {
	Form,
	useNavigate,
	useParams,
	useLoaderData,
	useSubmit,
	useOutletContext,
	useActionData,
} from '@remix-run/react'
import { APIRoute } from '~/utility/Routes'
import { useState } from 'react'
import type {
	ErrorResponse,
	FetchResponse,
	ProjectTestRunsOutletContext,
	PropertyConfiguration,
	TestCase,
	TestRun,
	UserSummary,
} from '~/models/types'
import TestCaseSelector from '~/components/TestCaseSelector'
import { AssigneePicker } from '~/components/Assignments'
import { Route } from '~/utility/Routes'
import { requireAPI } from '~/utility/API.server'
import { Tools } from '../utility/Tools'
import { ErrorMessage } from '../components/ErrorMessage'

interface CreateTestRun extends Record<string, any> {
	title: string
	description?: string
	testCaseIDs: string[]
	assigneeIDs: string[]
}

export async function loader({ request, params }: ActionFunctionArgs) {
	const api = await requireAPI(request)
	const projectShortCode = params.projectShortCode
	if (!projectShortCode) {
		throw new Response('Project short code is required', { status: 400 })
	}

	const [properties, testCases, projectUsers] = await Promise.all([
		api.get<FetchResponse<PropertyConfiguration[]>>(APIRoute.properties),
		api.get<FetchResponse<TestCase[]>>(
			APIRoute.projectTestCases(projectShortCode)
		),
		api.get<FetchResponse<UserSummary[]>>(
			APIRoute.projectUsers(projectShortCode)
		),
	])

	return {
		properties: properties.data,
		testCases: testCases.data,
		projectUsers: projectUsers.data,
	}
}

export async function action({ request, params }: ActionFunctionArgs) {
	const api = await requireAPI(request)
	try {
		const projectShortCode = params.projectShortCode
		if (!projectShortCode) {
			throw new Error('Project short code is required')
		}

		await api.post<void>(APIRoute.projectTestRuns(projectShortCode), {
			body: await request.json(),
		})

		return redirect(Route.viewProjectTestRuns(projectShortCode))
	} catch (error) {
		return Response.json(Tools.mapErrorToResponse(error), { status: 400 })
	}
}

export default function NewTestRun() {
	const navigate = useNavigate()
	const { properties, testCases, projectUsers } = useLoaderData<typeof loader>()
	const [assigneeIDs, setAssigneeIDs] = useState<string[]>([])
	const { project } = useOutletContext<ProjectTestRunsOutletContext>()
	const actionData = useActionData<ErrorResponse>()

	const [showTestCaseSelector, setShowTestCaseSelector] = useState(false)
	const [selectedTestCases, setSelectedTestCases] = useState<TestCase[]>([])
	const submit = useSubmit()

	const todayDateString = new Date()
		.toLocaleDateString('en-US', {
			year: 'numeric',
			month: '2-digit',
			day: '2-digit',
		})
		.replace(/\//g, '-')
	const defaultTitle = `${todayDateString} Test Run`

	const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault()

		const formData = new FormData(event.currentTarget)
		const jsonData: CreateTestRun = {
			title: formData.get('title') as string,
			description: formData.get('description') as string | undefined,
			testCaseIDs: selectedTestCases.map((tc) => tc.testCaseID),
			assigneeIDs,
		}

		submit(jsonData, {
			method: 'post',
			encType: 'application/json',
		})
	}

	return (
		<div className="space-y-6">
			<div>
				<h1 className="text-2xl font-semibold text-gray-900">
					{showTestCaseSelector ? 'Select Test Cases' : 'Create New Test Run'}
				</h1>
			</div>

			{actionData && <ErrorMessage message={actionData.message} />}

			{showTestCaseSelector ? (
				<div className="space-y-6">
					<TestCaseSelector
						project={project}
						properties={properties}
						testCases={testCases}
						onDone={(testCases) => {
							setSelectedTestCases(testCases)
							setShowTestCaseSelector(false)
						}}
						initialSelectedTestCases={selectedTestCases}
					/>
				</div>
			) : (
				<Form method="post" className="space-y-6" onSubmit={handleSubmit}>
					<div className="max-w-2xl">
						<div className="space-y-6">
							<div>
								<label
									htmlFor="title"
									className="block text-sm font-medium text-gray-700"
								>
									Title
								</label>
								<input
									type="text"
									name="title"
									id="title"
									required
									defaultValue={defaultTitle}
									className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
								/>
							</div>

							<div>
								<label
									htmlFor="description"
									className="block text-sm font-medium text-gray-700"
								>
									Description
								</label>
								<textarea
									name="description"
									id="description"
									rows={4}
									className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
								/>
							</div>
						</div>
					</div>

					<div className="space-y-3">
						<span className="block text-sm font-medium text-gray-700">
							Assigned to
						</span>
						<AssigneePicker
							users={projectUsers}
							selectedIDs={assigneeIDs}
							onChange={setAssigneeIDs}
						/>
						<p className="text-xs text-gray-500">
							Assigned users are notified. Any user with access to the project
							can still take test cases from the run.
						</p>
					</div>

					<div className="space-y-3">
						<span className="block text-sm font-medium text-gray-700">
							Test Cases
						</span>
						<div className="flex items-center gap-3">
							<div className="text-sm text-gray-500">
								{selectedTestCases.length > 0
									? `${selectedTestCases.length} test cases selected`
									: 'No test cases selected'}
							</div>
						</div>
						<button
							type="button"
							onClick={() => setShowTestCaseSelector(true)}
							className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
						>
							Change Selection
						</button>
					</div>

					<div className="flex justify-end gap-3">
						<button
							type="button"
							onClick={() => navigate(-1)}
							className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2"
						>
							Cancel
						</button>
						<button
							type="submit"
							className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 disabled:bg-brand-400"
						>
							Create Test Run
						</button>
					</div>
				</Form>
			)}
		</div>
	)
}
