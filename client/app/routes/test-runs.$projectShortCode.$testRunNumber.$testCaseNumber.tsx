import { type ActionFunctionArgs } from '@remix-run/node'
import {
	Link,
	redirect,
	redirectDocument,
	useActionData,
	useFetcher,
	useOutletContext,
	useParams,
} from '@remix-run/react'
import { APIRoute, Route } from '~/utility/Routes'
import {
	ProjectBuild,
	ProjectTestCaseRunsOutletContext,
	TestCaseRunStatus,
	ErrorResponse,
	FetchResponse,
	TestCaseRun,
	UpdateTestCaseRunDetails,
	CreateJiraIssue,
	JiraLink,
	PropertyConfiguration,
	TestRun,
	UserSummary,
} from '~/models/types'
import { Project } from '~/models/project'
import { useEffect, useState } from 'react'
import { Tools } from '~/utility/Tools'
import { BackButton } from '~/components/BackButton'
import { requireAPI } from '~/utility/API.server'
import { ErrorMessage } from '../components/ErrorMessage'
import { LinkifiedText } from '~/components/LinkifiedText'
import { AttachmentGallery } from '~/components/AttachmentGallery'
import { JiraIssuesPanel } from '~/components/JiraIssuesPanel'
import { publicBaseURL } from '~/utility/PublicURL.server'
import { TestCaseAssignment } from '~/components/Assignments'
import { TestRunBuild } from '~/components/Builds'
import { TestCaseTimer } from '~/components/TimeTracking'
import { useCurrentUser, useIsAdmin } from '~/utility/CurrentUser'

interface UpdateTestCaseRun extends Record<string, any> {
	status: TestCaseRunStatus
	notes?: string
}

export async function action({ request, params }: ActionFunctionArgs) {
	const api = await requireAPI(request)
	try {
		const projectShortCode = params.projectShortCode
		const testRunNumber = Number(params.testRunNumber)
		if (!projectShortCode || !testRunNumber) {
			throw new Error('Invalid project short code or test run number')
		}

		const {
			intent,
			testCaseRunID,
			testCaseRunUpdate,
			detailsUpdate,
			jiraIssue,
		} = await request.json()

		if (intent === 'createJiraIssue') {
			const response = await api.post<FetchResponse<JiraLink>>(
				APIRoute.createJiraIssue(testCaseRunID),
				{ body: { ...jiraIssue, appBaseURL: publicBaseURL(request) } }
			)
			return { ok: true, issueKey: response.data.issueKey }
		}

		if (intent === 'updateDetails') {
			await api.put<void>(APIRoute.testCaseRunDetails(testCaseRunID), {
				body: detailsUpdate,
			})
			return { ok: true }
		}

		// the public URL lets automatically created Jira issues link back to SparkyTC
		await api.put<void>(APIRoute.testCaseRun(testCaseRunID), {
			body: { ...testCaseRunUpdate, appBaseURL: publicBaseURL(request) },
		})

		const nextTestCaseRun = await api.get<
			FetchResponse<TestCaseRun | undefined>
		>(APIRoute.nextTestCaseRun(testCaseRunID))
		if (nextTestCaseRun.data) {
			return redirectDocument(
				Route.viewTestCaseRun(
					projectShortCode,
					testRunNumber,
					nextTestCaseRun.data.testCase.testCaseNumber
				)
			)
		} else {
			return redirect(Route.viewTestRun(projectShortCode, testRunNumber))
		}
	} catch (error) {
		return Response.json(Tools.mapErrorToResponse(error), {
			status: 400,
		})
	}
}

export default function TestCaseRunDetails() {
	const params = useParams()
	const { project, testRun, testCaseRuns, properties, projectUsers, builds } =
		useOutletContext<ProjectTestCaseRunsOutletContext>()
	const testCaseNumber = Number(params.testCaseNumber)
	if (!testCaseNumber) {
		return <p>Test case number is required</p>
	}

	const testCaseRun = testCaseRuns.find(
		(run) => run.testCase.testCaseNumber === testCaseNumber
	)
	if (!testCaseRun) {
		return <p>Test case run not found</p>
	}

	return (
		<TestCaseRunView
			key={testCaseRun.testCaseRunID}
			project={project}
			testRun={testRun}
			testCaseRun={testCaseRun}
			properties={properties}
			projectUsers={projectUsers}
			builds={builds}
		/>
	)
}

interface TestCaseRunViewProps {
	project: Project
	testRun: TestRun
	testCaseRun: TestCaseRun
	properties: PropertyConfiguration[]
	projectUsers: UserSummary[]
	builds: ProjectBuild[]
}

function propertyValue(
	testCaseRun: TestCaseRun,
	properties: PropertyConfiguration[],
	title: string
) {
	const property = properties.find(
		(property) => property.title.trim().toLowerCase() === title
	)
	return property
		? testCaseRun.testCase.propertyValues[property.propertyConfigurationID]
		: undefined
}

function TestCaseRunView({
	project,
	testRun,
	testCaseRun,
	properties,
	projectUsers,
	builds,
}: TestCaseRunViewProps) {
	const actionData = useActionData<ErrorResponse>()
	const currentUser = useCurrentUser()
	const isAdmin = useIsAdmin()
	// a test case taken by someone else can only be recorded by them or an admin
	const assignedToOther =
		!!testCaseRun.assignedTo &&
		testCaseRun.assignedTo.userID !== currentUser?.userID
	const isLocked = assignedToOther && !isAdmin

	const fetcher = useFetcher<ErrorResponse>()
	const [isEditing, setIsEditing] = useState(false)
	const [selectedStatus, setSelectedStatus] = useState<TestCaseRunStatus>(
		testCaseRun.status
	)

	const handleSave = () => {
		const form = document.getElementById('testCaseForm') as HTMLFormElement
		const notes = new FormData(form).get('notes') as string

		const minutes = Number(new FormData(form).get('manualMinutes') || 0)
		const testCaseRunUpdate: UpdateTestCaseRun = {
			status: selectedStatus,
			notes,
			...(minutes > 0 ? { manualSeconds: Math.round(minutes * 60) } : {}),
		}

		fetcher.submit(
			{
				testCaseRunID: testCaseRun.testCaseRunID,
				testCaseRunUpdate,
			},
			{
				method: 'post',
				encType: 'application/json',
			}
		)
	}

	return (
		<div className="space-y-6">
			<BackButton />

			<div>
				<div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
					<h1 className="text-2xl font-semibold text-gray-900">
						{testCaseRun.title}
					</h1>
					{testCaseRun.testCase.isArchived ? (
						<span
							className="text-sm text-gray-500"
							title="The test case was deleted from the project, this run keeps its result"
						>
							{Tools.testCaseDisplayCode(project, testCaseRun.testCase)}{' '}
							<span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
								Archived
							</span>
						</span>
					) : (
						<Link
							to={Route.viewTestCase(
								project.projectShortCode,
								testCaseRun.testCase.testCaseNumber
							)}
							className="text-sm text-gray-600 hover:text-gray-900 hover:underline"
						>
							View {Tools.testCaseDisplayCode(project, testCaseRun.testCase)}
						</Link>
					)}
				</div>
				<p className="mt-2 text-gray-600">Test Case Run Details</p>
			</div>

			{actionData && <ErrorMessage message={actionData.message} />}
			{fetcher.data?.message && <ErrorMessage message={fetcher.data.message} />}

			<div className="space-y-8">
				<section className="mt-6">
					<h2 className="mb-2 text-xl font-semibold text-gray-900">
						Assigned to
					</h2>
					<TestCaseAssignment
						testRun={testRun}
						testCaseRun={testCaseRun}
						projectUsers={projectUsers}
					/>
					{isLocked && (
						<p className="mt-2 rounded-md bg-yellow-50 p-3 text-sm text-yellow-800">
							{testCaseRun.assignedTo?.displayName} is working on this test
							case, so you can't record its result.
						</p>
					)}
				</section>

				<section>
					<h2 className="mb-2 text-xl font-semibold text-gray-900">Build</h2>
					<TestRunBuild testRun={testRun} builds={builds} />
					<p className="mt-1 text-xs text-gray-500">
						Applies to the whole test run.
					</p>
				</section>

				{testRun.trackTime && (
					<section>
						<h2 className="mb-2 text-xl font-semibold text-gray-900">
							Time spent
						</h2>
						<TestCaseTimer
							testRun={testRun}
							testCaseRun={testCaseRun}
							isLocked={isLocked}
						/>
					</section>
				)}

				<section>
					<div className="flex justify-between items-center mb-4">
						<h2 className="text-xl font-semibold text-gray-900">Status</h2>
					</div>
					<fieldset
						disabled={isLocked}
						className="flex gap-3 disabled:opacity-50"
					>
						<button
							type="button"
							onClick={() => setSelectedStatus(TestCaseRunStatus.pass)}
							className={`px-4 py-2 text-sm font-medium rounded-md ${
								selectedStatus === TestCaseRunStatus.pass
									? 'bg-green-100 text-green-800 ring-1 ring-green-600'
									: 'bg-gray-50 text-gray-700 hover:bg-green-50 hover:text-green-700'
							}`}
						>
							Pass
						</button>
						<button
							type="button"
							onClick={() => setSelectedStatus(TestCaseRunStatus.fail)}
							className={`px-4 py-2 text-sm font-medium rounded-md ${
								selectedStatus === TestCaseRunStatus.fail
									? 'bg-red-100 text-red-800 ring-1 ring-red-600'
									: 'bg-gray-50 text-gray-700 hover:bg-red-50 hover:text-red-700'
							}`}
						>
							Fail
						</button>
						<button
							type="button"
							onClick={() => setSelectedStatus(TestCaseRunStatus.skip)}
							className={`px-4 py-2 text-sm font-medium rounded-md ${
								selectedStatus === TestCaseRunStatus.skip
									? 'bg-yellow-100 text-yellow-800 ring-1 ring-yellow-600'
									: 'bg-gray-50 text-gray-700 hover:bg-yellow-50 hover:text-yellow-700'
							}`}
						>
							Skip
						</button>
					</fieldset>
				</section>

				<section>
					<h2 className="text-xl font-semibold text-gray-900 mb-4">Details</h2>
					<dl className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
						<div>
							<dt className="text-sm font-medium text-gray-500">
								Test Case Number
							</dt>
							<dd className="mt-1 text-sm text-gray-900">
								{testCaseRun.testCase.testCaseNumber}
							</dd>
						</div>
						<div>
							<dt className="text-sm font-medium text-gray-500">Created</dt>
							<dd className="mt-1 text-sm text-gray-900">
								{new Date(testCaseRun.creationDate).toLocaleString()}
							</dd>
						</div>
						{testCaseRun.executedBy && (
							<div>
								<dt className="text-sm font-medium text-gray-500">
									Result recorded by
								</dt>
								<dd className="mt-1 text-sm text-gray-900">
									{testCaseRun.executedBy}
								</dd>
							</div>
						)}
					</dl>
				</section>

				{isEditing ? (
					<TestCaseRunDetailsEditor
						testCaseRun={testCaseRun}
						onClose={() => setIsEditing(false)}
					/>
				) : (
					<>
						<div className="flex justify-end">
							<button
								type="button"
								onClick={() => setIsEditing(true)}
								className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
							>
								Edit Test Case Details
							</button>
						</div>

						{testCaseRun.description && (
							<section>
								<h2 className="text-xl font-semibold text-gray-900 mb-4">
									Description
								</h2>
								<div className="prose prose-sm max-w-none whitespace-pre-wrap">
									<LinkifiedText text={testCaseRun.description} />
								</div>
							</section>
						)}

						<section>
							<h2 className="text-xl font-semibold text-gray-900 mb-4">
								Test Instructions
							</h2>
							<div className="prose prose-sm max-w-none whitespace-pre-wrap">
								{testCaseRun.testInstructions ? (
									<LinkifiedText text={testCaseRun.testInstructions} />
								) : (
									'No test instructions available'
								)}
							</div>
						</section>
					</>
				)}

				<section>
					<h2 className="text-xl font-semibold text-gray-900 mb-4">
						Images and Videos
					</h2>
					<AttachmentGallery
						testCaseID={testCaseRun.testCase.testCaseID}
						attachments={testCaseRun.testCase.attachments ?? []}
						editable
					/>
				</section>

				<section>
					<h2 className="text-xl font-semibold text-gray-900 mb-4">
						Jira Issues
					</h2>
					<JiraIssuesPanel
						testCaseID={testCaseRun.testCase.testCaseID}
						links={testCaseRun.testCase.jiraLinks ?? []}
						editable
						jiraFailureMode={project.jiraFailureMode}
						jiraProjectKey={project.jiraProjectKey}
						jiraIssueType={project.jiraIssueType}
						createIssue={{
							testCaseRunID: testCaseRun.testCaseRunID,
							isFailed: selectedStatus === TestCaseRunStatus.fail,
							defaults: (): CreateJiraIssue => {
								const form = document.getElementById(
									'testCaseForm'
								) as HTMLFormElement | null
								const notes = form
									? (new FormData(form).get('notes') as string)
									: testCaseRun.notes
								return {
									summary: testCaseRun.title,
									stepsToReproduce: testCaseRun.testInstructions ?? '',
									expectedResult:
										propertyValue(testCaseRun, properties, 'expected result') ??
										'',
									actualResult: notes ?? '',
									buildNumber:
										testRun.build?.buildNumber ??
										propertyValue(testCaseRun, properties, 'build number') ??
										'',
								}
							},
						}}
					/>
				</section>

				<form id="testCaseForm">
					<section>
						<h2 className="text-xl font-semibold text-gray-900 mb-4">Notes</h2>
						<textarea
							name="notes"
							defaultValue={testCaseRun.notes}
							className="w-full min-h-[100px] p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
							placeholder="Enter any notes or observations about this test case run"
						/>
					</section>
					{/* if the timer wasn't used, the time can be typed in with the result */}
					{testRun.trackTime &&
						testCaseRun.timeSeconds === 0 &&
						testCaseRun.runningTimers.length === 0 &&
						selectedStatus !== TestCaseRunStatus.pending && (
							<section className="mt-4">
								<label
									htmlFor="manualMinutes"
									className="block text-sm font-medium text-gray-700"
								>
									Time spent in minutes (optional)
								</label>
								<input
									id="manualMinutes"
									name="manualMinutes"
									type="number"
									min={0}
									max={1440}
									step={1}
									placeholder="e.g. 15"
									className="mt-1 block w-32 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
								/>
								<p className="mt-1 text-xs text-gray-500">
									The timer wasn&apos;t used for this test case. Add how long
									testing took, if you know.
								</p>
							</section>
						)}
				</form>

				<div className="flex justify-end">
					<button
						type="button"
						onClick={handleSave}
						disabled={isLocked}
						className="px-4 py-2 text-sm font-medium text-white bg-brand-600 rounded-md hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
					>
						Save Changes
					</button>
				</div>
			</div>
		</div>
	)
}

interface TestCaseRunDetailsEditorProps {
	testCaseRun: TestCaseRun
	onClose: () => void
}

function TestCaseRunDetailsEditor({
	testCaseRun,
	onClose,
}: TestCaseRunDetailsEditorProps) {
	const fetcher = useFetcher<ErrorResponse | { ok: true }>()
	const isSaving = fetcher.state !== 'idle'
	const error =
		fetcher.data && 'message' in fetcher.data ? fetcher.data.message : undefined

	useEffect(() => {
		if (fetcher.state === 'idle' && fetcher.data && 'ok' in fetcher.data) {
			onClose()
		}
	}, [fetcher.state, fetcher.data, onClose])

	const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault()
		const formData = new FormData(event.currentTarget)

		const detailsUpdate: UpdateTestCaseRunDetails = {
			title: formData.get('title') as string,
			description: formData.get('description') as string,
			testInstructions: formData.get('testInstructions') as string,
			applyToTestCase: formData.get('applyToTestCase') === 'on',
		}

		fetcher.submit(
			{
				intent: 'updateDetails',
				testCaseRunID: testCaseRun.testCaseRunID,
				detailsUpdate,
			},
			{ method: 'post', encType: 'application/json' }
		)
	}

	const inputClassName =
		'mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500'

	return (
		<form
			onSubmit={handleSubmit}
			className="space-y-4 rounded-md border border-gray-200 bg-gray-50 p-4"
		>
			<h2 className="text-xl font-semibold text-gray-900">
				Edit Test Case Details
			</h2>

			{error && <ErrorMessage message={error} />}

			<div>
				<label
					htmlFor="runTitle"
					className="block text-sm font-medium text-gray-700"
				>
					Title
				</label>
				<input
					id="runTitle"
					name="title"
					type="text"
					required
					defaultValue={testCaseRun.title}
					className={inputClassName}
				/>
			</div>

			<div>
				<label
					htmlFor="runDescription"
					className="block text-sm font-medium text-gray-700"
				>
					Description
				</label>
				<textarea
					id="runDescription"
					name="description"
					rows={3}
					defaultValue={testCaseRun.description}
					className={inputClassName}
				/>
			</div>

			<div>
				<label
					htmlFor="runTestInstructions"
					className="block text-sm font-medium text-gray-700"
				>
					Test Instructions
				</label>
				<textarea
					id="runTestInstructions"
					name="testInstructions"
					rows={6}
					defaultValue={testCaseRun.testInstructions}
					className={inputClassName}
				/>
				<p className="mt-1 text-xs text-gray-500">
					Links such as https://example.com become clickable
				</p>
			</div>

			{/* an archived test case is no longer part of the project */}
			{!testCaseRun.testCase.isArchived && (
				<label className="flex items-start gap-2 text-sm text-gray-700">
					<input
						type="checkbox"
						name="applyToTestCase"
						className="mt-0.5 h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
					/>
					<span>
						Also update the original test case
						<span className="block text-xs text-gray-500">
							When unchecked, the changes only apply to this test run
						</span>
					</span>
				</label>
			)}

			<div className="flex justify-end gap-3">
				<button
					type="button"
					onClick={onClose}
					className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
				>
					Cancel
				</button>
				<button
					type="submit"
					disabled={isSaving}
					className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
				>
					{isSaving ? 'Saving...' : 'Save Details'}
				</button>
			</div>
		</form>
	)
}
