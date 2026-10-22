import { type ActionFunctionArgs, redirect } from '@remix-run/node'
import {
	Link,
	useActionData,
	useNavigate,
	useOutletContext,
	useParams,
	useSubmit,
} from '@remix-run/react'
import { BackButton } from '~/components/BackButton'
import { ErrorMessage } from '~/components/ErrorMessage'
import { LabelChip } from '~/components/LabelInput'
import { Table, type Column } from '~/components/Table'
import { TestRunStatusBadge } from '~/components/TestRunStatusBadge'
import {
	ErrorResponse,
	ProjectTestPlansOutletContext,
	TestCase,
} from '~/models/types'
import { requireAPI } from '~/utility/API.server'
import { useIsAdmin } from '~/utility/CurrentUser'
import { APIRoute, Route } from '~/utility/Routes'
import { groupBySection, sectionPath } from '~/utility/Sections'
import { PlanReason, planTestCases } from '~/utility/TestPlans'
import { Tools } from '~/utility/Tools'

export async function action({ request, params }: ActionFunctionArgs) {
	const api = await requireAPI(request)
	try {
		await api.delete(APIRoute.testPlan(params.testPlanID ?? ''))
		return redirect(Route.viewTestPlans(params.projectShortCode ?? ''))
	} catch (error) {
		return Response.json(Tools.mapErrorToResponse(error), { status: 400 })
	}
}

const REASON_LABELS: Record<PlanReason, string> = {
	section: 'Section',
	label: 'Label',
	chosen: 'Chosen',
}

export default function TestPlanDetails() {
	const { project, testPlans, testCases, sections, testRuns } =
		useOutletContext<ProjectTestPlansOutletContext>()
	const { testPlanID } = useParams()
	const isAdmin = useIsAdmin()
	const navigate = useNavigate()
	const submit = useSubmit()
	const actionData = useActionData<ErrorResponse>()
	const plan = testPlans.find((plan) => plan.testPlanID === testPlanID)
	if (!plan) return <p>Test plan not found</p>

	const matches = planTestCases(plan, testCases, sections)
	const reasons = new Map(
		matches.map((match) => [match.testCase.testCaseID, match.reasons])
	)
	const groups = groupBySection(
		sections,
		matches.map((match) => match.testCase)
	)
	const runs = testRuns
		.filter((run) => run.testPlanID === plan.testPlanID)
		.sort((a, b) => b.creationDate - a.creationDate)

	const columns: Column<TestCase>[] = [
		{
			header: 'ID',
			key: 'id',
			mobile: 'subtitle',
			render: (testCase) => Tools.testCaseDisplayCode(project, testCase),
		},
		{
			header: 'Title',
			key: 'title',
			mobile: 'title',
			render: (testCase) => testCase.title,
		},
		{
			header: 'In the plan by',
			key: 'reason',
			render: (testCase) =>
				(reasons.get(testCase.testCaseID) ?? [])
					.map((reason) => REASON_LABELS[reason])
					.join(', '),
		},
	]

	return (
		<div className="space-y-6">
			<BackButton />
			{actionData && <ErrorMessage message={actionData.message} />}

			<div className="flex flex-col-reverse items-start justify-between gap-3 sm:flex-row">
				<div>
					<h2 className="text-2xl font-semibold text-gray-900">{plan.name}</h2>
					{plan.description && (
						<p className="mt-1 whitespace-pre-wrap text-gray-700">
							{plan.description}
						</p>
					)}
					{plan.updatedBy && (
						<p className="mt-1 text-xs text-gray-500">
							Last updated by {plan.updatedBy}
						</p>
					)}
				</div>
				<div className="flex flex-wrap gap-2 self-end sm:self-start">
					<Link
						to="edit"
						className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
					>
						Edit
					</Link>
					{isAdmin && (
						<button
							type="button"
							onClick={() => {
								if (
									confirm(
										`Delete the test plan ${plan.name}? Test runs started from it keep their test cases and results.`
									)
								) {
									submit(null, { method: 'post' })
								}
							}}
							className="rounded-md border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
						>
							Delete
						</button>
					)}
					<Link
						to={Route.newTestRunFromPlan(
							project.projectShortCode,
							plan.testPlanID
						)}
						aria-disabled={matches.length === 0}
						className={`rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 ${
							matches.length === 0 ? 'pointer-events-none opacity-50' : ''
						}`}
					>
						Start test run
					</Link>
				</div>
			</div>

			<section className="space-y-2 text-sm">
				<h3 className="text-lg font-medium text-gray-900">Rules</h3>
				<dl className="grid gap-2 sm:grid-cols-[10rem_1fr]">
					<dt className="text-gray-500">Suites and sections</dt>
					<dd className="text-gray-900">
						{plan.sectionIDs.length > 0
							? plan.sectionIDs
									.map((id) => sectionPath(sections, id))
									.join(', ')
							: '-'}
					</dd>
					<dt className="text-gray-500">Labels</dt>
					<dd className="flex flex-wrap gap-1">
						{plan.labels.map((label) => (
							<LabelChip key={label} label={label} />
						))}
						{plan.labels.length === 0 && '-'}
					</dd>
					<dt className="text-gray-500">Chosen test cases</dt>
					<dd className="text-gray-900">{plan.testCaseIDs.length}</dd>
				</dl>
			</section>

			<section className="space-y-4">
				<h3 className="text-lg font-medium text-gray-900">
					Test cases ({matches.length})
				</h3>
				{groups.length === 0 && (
					<p className="text-sm text-gray-500">
						The rules don&apos;t choose any test case right now.
					</p>
				)}
				{groups.map((group) => (
					<div key={group.section?.sectionID ?? 'unfiled'}>
						<h4 className="mb-2 text-sm font-semibold text-gray-700">
							{group.section
								? sectionPath(sections, group.section.sectionID)
								: 'No section'}
							<span className="ml-2 font-normal text-gray-500">
								{group.testCases.length}
							</span>
						</h4>
						<Table
							tableRows={group.testCases.map((testCase) => ({
								id: testCase.testCaseID,
								data: testCase,
							}))}
							columns={columns}
							onRowClick={(testCase) =>
								navigate(
									Route.viewTestCase(
										project.projectShortCode,
										testCase.testCaseNumber
									)
								)
							}
						/>
					</div>
				))}
			</section>

			<section>
				<h3 className="mb-2 text-lg font-medium text-gray-900">
					Test runs from this plan
				</h3>
				{runs.length === 0 ? (
					<p className="text-sm text-gray-500">Not run yet.</p>
				) : (
					<ul className="divide-y divide-gray-200 rounded-md border border-gray-200 bg-white">
						{runs.map((run) => (
							<li key={run.testRunID}>
								<Link
									to={Route.viewTestRun(
										project.projectShortCode,
										run.testRunNumber
									)}
									className="flex flex-wrap items-center gap-3 px-3 py-2 text-sm hover:bg-gray-50"
								>
									<span className="font-medium text-gray-900">
										#{run.testRunNumber} {run.title}
									</span>
									{run.build && (
										<span className="text-xs text-gray-500">
											Build {run.build.buildNumber}
										</span>
									)}
									<span className="ml-auto">
										<TestRunStatusBadge status={run.status} />
									</span>
								</Link>
							</li>
						))}
					</ul>
				)}
			</section>
		</div>
	)
}
