import { type LoaderFunctionArgs } from '@remix-run/node'
import { Link, useLoaderData } from '@remix-run/react'
import { CurrentBuildCard } from '~/components/Builds'
import { RateChart } from '~/components/RateChart'
import { DateDisplay } from '~/components/DateDisplay'
import { ProjectShell } from '~/components/ProjectShell'
import { RunProgressBar } from '~/components/RunProgressBar'
import { TestRunStatusBadge } from '~/components/TestRunStatusBadge'
import { Project } from '~/models/project'
import {
	FetchResponse,
	ProjectDashboard,
	TestCaseRunStatus,
	TestRunStatus,
	TestRunSummary,
} from '~/models/types'
import { requireAPI } from '~/utility/API.server'
import { APIRoute, Route } from '~/utility/Routes'

export async function loader({ request, params }: LoaderFunctionArgs) {
	const api = await requireAPI(request)
	const projectShortCode = params.projectShortCode
	if (!projectShortCode) {
		throw new Response('Project short code is required', { status: 400 })
	}

	const projects = await api.get<FetchResponse<Project[]>>(APIRoute.projects)
	if (!projects.data.some((p) => p.projectShortCode === projectShortCode)) {
		throw new Response('Project not found', { status: 404 })
	}
	const dashboard = await api.get<FetchResponse<ProjectDashboard>>(
		APIRoute.projectDashboard(projectShortCode)
	)
	return { projects: projects.data, dashboard: dashboard.data }
}

export default function ProjectDashboardPage() {
	const { projects, dashboard } = useLoaderData<typeof loader>()
	const { project } = dashboard
	const totalRuns = Object.values(dashboard.testRunCounts).reduce(
		(sum, count) => sum + count,
		0
	)

	return (
		<ProjectShell projects={projects} currentProject={project}>
			<div className="space-y-8">
				<section
					className="grid grid-cols-2 gap-4 lg:grid-cols-4"
					aria-label="Summary"
				>
					<StatTile
						label="Test cases"
						value={dashboard.testCaseCount}
						to={Route.viewProjectTestCases(project.projectShortCode)}
					/>
					<StatTile
						label="Test runs"
						value={totalRuns}
						detail={`${
							dashboard.testRunCounts[TestRunStatus.complete] ?? 0
						} complete`}
						to={Route.viewProjectTestRuns(project.projectShortCode)}
					/>
					<StatTile
						label="Active test runs"
						value={dashboard.activeTestRuns.length}
						detail="pending or in progress"
					/>
					<StatTile
						label="Linked Jira issues"
						value={dashboard.linkedJiraIssueCount}
					/>
				</section>

				<section aria-label="Build" className="space-y-4">
					<CurrentBuildCard
						key={dashboard.currentBuild?.buildID}
						projectShortCode={project.projectShortCode}
						build={dashboard.currentBuild}
					/>
					{dashboard.currentBuild && (
						<div className="rounded-lg border border-gray-200 bg-white p-4">
							<div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
								<h2 className="text-sm font-semibold text-gray-900">
									Results on build {dashboard.currentBuild.buildNumber}
								</h2>
								<Link
									to={Route.viewProjectBuilds(project.projectShortCode)}
									className="text-xs font-medium text-brand-600 hover:underline"
								>
									Previous builds
								</Link>
							</div>
							{dashboard.currentBuildTimeline.length === 0 ? (
								<p className="text-sm text-gray-500">
									No test runs on this build yet.
								</p>
							) : (
								<>
									<p className="mb-3 text-xs text-gray-500">
										Test cases of the build after each test run, counting the
										latest result of each one. Pass and fail rates are over the
										executed test cases (passed, failed and skipped).
									</p>
									<RateChart
										firstColumn="Test run"
										points={dashboard.currentBuildTimeline.map((point) => ({
											id: point.testRunID,
											label: `#${point.testRunNumber}`,
											title: `#${point.testRunNumber} ${point.title}`,
											counts: point.counts,
										}))}
									/>
								</>
							)}
						</div>
					)}
				</section>

				<section>
					<h2 className="mb-3 text-lg font-semibold text-gray-900">
						Active test runs
					</h2>
					{dashboard.activeTestRuns.length === 0 ? (
						<p className="text-sm text-gray-500">
							No test runs in progress.{' '}
							<Link
								to={`${Route.viewProjectTestRuns(
									project.projectShortCode
								)}/new`}
								className="text-brand-600 hover:underline"
							>
								Start a test run
							</Link>
						</p>
					) : (
						<div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
							{dashboard.activeTestRuns.map((testRun) => (
								<ActiveRunCard
									key={testRun.testRunID}
									projectShortCode={project.projectShortCode}
									testRun={testRun}
								/>
							))}
						</div>
					)}
				</section>

				{dashboard.testCaseCount > 0 &&
					dashboard.propertyBreakdowns.length > 0 && (
						<section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
							{dashboard.propertyBreakdowns.map((breakdown) => (
								<BreakdownCard
									key={breakdown.title}
									title={`Test cases by ${breakdown.title.toLowerCase()}`}
									counts={breakdown.counts}
									total={dashboard.testCaseCount}
								/>
							))}
						</section>
					)}

				<section>
					<h2 className="mb-3 text-lg font-semibold text-gray-900">
						Recent test runs
					</h2>
					{dashboard.recentTestRuns.length === 0 ? (
						<p className="text-sm text-gray-500">No finished test runs yet.</p>
					) : (
						<div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
							<table className="min-w-full divide-y divide-gray-200 text-sm">
								<thead className="bg-gray-50">
									<tr>
										{['Run', 'Status', 'Results', 'Created'].map((header) => (
											<th
												key={header}
												className="px-4 py-2 text-left font-medium text-gray-500"
											>
												{header}
											</th>
										))}
									</tr>
								</thead>
								<tbody className="divide-y divide-gray-200">
									{dashboard.recentTestRuns.map((testRun) => (
										<tr key={testRun.testRunID}>
											<td className="px-4 py-3">
												<Link
													to={Route.viewTestRun(
														project.projectShortCode,
														testRun.testRunNumber
													)}
													className="font-medium text-gray-900 hover:text-brand-600 hover:underline"
												>
													#{testRun.testRunNumber} {testRun.title}
												</Link>
											</td>
											<td className="px-4 py-3">
												<TestRunStatusBadge status={testRun.status} />
											</td>
											<td className="w-64 px-4 py-3">
												<RunProgressBar
													resultCounts={testRun.resultCounts}
													totalCount={testRun.totalCount}
													showLegend={false}
												/>
												<div className="mt-1 text-xs text-gray-500">
													{resultSummary(testRun)}
												</div>
											</td>
											<td className="whitespace-nowrap px-4 py-3">
												<DateDisplay date={testRun.creationDate} />
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					)}
				</section>
			</div>
		</ProjectShell>
	)
}

function resultSummary(testRun: TestRunSummary) {
	const passed = testRun.resultCounts[TestCaseRunStatus.pass] ?? 0
	const failed = testRun.resultCounts[TestCaseRunStatus.fail] ?? 0
	const skipped = testRun.resultCounts[TestCaseRunStatus.skip] ?? 0
	return `${passed} passed · ${failed} failed · ${skipped} skipped of ${testRun.totalCount}`
}

function StatTile({
	label,
	value,
	detail,
	to,
}: {
	label: string
	value: number
	detail?: string
	to?: string
}) {
	const content = (
		<>
			<div className="text-sm font-medium text-gray-500">{label}</div>
			<div className="mt-1 text-3xl font-semibold tabular-nums text-gray-900">
				{value}
			</div>
			{detail && <div className="mt-1 text-xs text-gray-500">{detail}</div>}
		</>
	)
	const className = 'block rounded-lg border border-gray-200 bg-white p-4'
	return to ? (
		<Link to={to} className={`${className} hover:border-brand-500`}>
			{content}
		</Link>
	) : (
		<div className={className}>{content}</div>
	)
}

function ActiveRunCard({
	projectShortCode,
	testRun,
}: {
	projectShortCode: string
	testRun: TestRunSummary
}) {
	const done =
		testRun.totalCount - (testRun.resultCounts[TestCaseRunStatus.pending] ?? 0)
	const percent =
		testRun.totalCount > 0 ? Math.round((done / testRun.totalCount) * 100) : 0

	return (
		<Link
			to={Route.viewTestRun(projectShortCode, testRun.testRunNumber)}
			className="block rounded-lg border border-gray-200 bg-white p-4 hover:border-brand-500"
		>
			<div className="mb-3 flex items-start justify-between gap-3">
				<div className="min-w-0">
					<div className="truncate font-medium text-gray-900">
						#{testRun.testRunNumber} {testRun.title}
					</div>
					<div className="text-xs text-gray-500">
						{testRun.createdBy ? `Created by ${testRun.createdBy} · ` : ''}
						{done} of {testRun.totalCount} executed ({percent}%)
					</div>
				</div>
				<TestRunStatusBadge status={testRun.status} />
			</div>
			<RunProgressBar
				resultCounts={testRun.resultCounts}
				totalCount={testRun.totalCount}
			/>
		</Link>
	)
}

function BreakdownCard({
	title,
	counts,
	total,
}: {
	title: string
	counts: { value: string; count: number }[]
	total: number
}) {
	const max = Math.max(1, ...counts.map((item) => item.count))
	return (
		<div className="rounded-lg border border-gray-200 bg-white p-4">
			<h3 className="mb-3 text-sm font-semibold text-gray-900">{title}</h3>
			<dl className="space-y-2">
				{counts.map((item) => (
					<div
						key={item.value}
						className="grid grid-cols-[7rem_1fr_3rem] items-center gap-3 text-sm"
						title={`${item.value}: ${item.count} of ${total} test cases`}
					>
						<dt className="truncate text-gray-700">{item.value}</dt>
						<dd className="h-2 rounded-full bg-gray-100">
							<div
								className="h-2 rounded-full bg-gray-700"
								style={{ width: `${(item.count / max) * 100}%` }}
							/>
						</dd>
						<dd className="text-right tabular-nums text-gray-700">
							{item.count}
						</dd>
					</div>
				))}
			</dl>
		</div>
	)
}
