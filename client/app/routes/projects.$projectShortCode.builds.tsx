import { type LoaderFunctionArgs } from '@remix-run/node'
import { Link, useLoaderData } from '@remix-run/react'
import { DateDisplay } from '~/components/DateDisplay'
import { ProjectShell } from '~/components/ProjectShell'
import { formatRate, RateChart } from '~/components/RateChart'
import { formatDuration } from '~/components/TimeTracking'
import { RunProgressBar } from '~/components/RunProgressBar'
import { TestRunStatusBadge } from '~/components/TestRunStatusBadge'
import { Project } from '~/models/project'
import {
	BuildResultCounts,
	BuildResults,
	FetchResponse,
	TestCaseRunStatus,
} from '~/models/types'
import { requireAPI } from '~/utility/API.server'
import { APIRoute, Route } from '~/utility/Routes'

export async function loader({ request, params }: LoaderFunctionArgs) {
	const api = await requireAPI(request)
	const projectShortCode = params.projectShortCode ?? ''
	const projects = await api.get<FetchResponse<Project[]>>(APIRoute.projects)
	const project = projects.data.find(
		(p) => p.projectShortCode === projectShortCode
	)
	if (!project) {
		throw new Response('Project not found', { status: 404 })
	}
	const builds = await api.get<FetchResponse<BuildResults[]>>(
		APIRoute.projectBuildResults(projectShortCode)
	)
	return { projects: projects.data, project, builds: builds.data }
}

function resultCounts(counts: BuildResultCounts) {
	return {
		[TestCaseRunStatus.pass]: counts.passed,
		[TestCaseRunStatus.fail]: counts.failed,
		[TestCaseRunStatus.skip]: counts.skipped,
		[TestCaseRunStatus.pending]: counts.pending,
	} as Record<TestCaseRunStatus, number>
}

/** Results of the test runs on each build, to compare the current build with the previous ones. */
export default function ProjectBuilds() {
	const { projects, project, builds } = useLoaderData<typeof loader>()
	// oldest build first, like a timeline
	const chartPoints = builds
		.filter((results) => results.build && results.counts.testCaseCount > 0)
		.reverse()
		.map((results) => ({
			id: results.build?.buildID ?? 'none',
			label: results.build?.buildNumber ?? '',
			title: `Build ${results.build?.buildNumber}`,
			counts: results.counts,
		}))

	return (
		<ProjectShell projects={projects} currentProject={project}>
			<div className="space-y-6">
				<div>
					<h2 className="text-lg font-semibold text-gray-900">Builds</h2>
					<p className="mt-1 text-sm text-gray-600">
						Results of the test runs on each build, newest first. Each build
						counts the latest result of each test case across its test runs;
						rates are over the executed test cases (passed, failed and skipped).
					</p>
				</div>

				{chartPoints.length > 1 && (
					<section className="rounded-lg border border-gray-200 bg-white p-4">
						<h3 className="mb-3 text-sm font-semibold text-gray-900">
							Results by build
						</h3>
						<RateChart firstColumn="Build" points={chartPoints} />
					</section>
				)}

				{builds.length === 0 ? (
					<p className="text-sm text-gray-500">
						No builds registered yet. Admins register them from the project
						dashboard.
					</p>
				) : (
					<div className="space-y-4">
						{builds.map((results, index) => (
							<BuildCard
								key={results.build?.buildID ?? 'none'}
								projectShortCode={project.projectShortCode}
								results={results}
								isCurrent={index === 0 && !!results.build}
							/>
						))}
					</div>
				)}
			</div>
		</ProjectShell>
	)
}

function BuildCard({
	projectShortCode,
	results,
	isCurrent,
}: {
	projectShortCode: string
	results: BuildResults
	isCurrent: boolean
}) {
	const { build, counts, testRuns } = results

	return (
		<section className="rounded-lg border border-gray-200 bg-white p-4">
			<div className="flex flex-wrap items-start justify-between gap-3">
				<div className="min-w-0">
					<h3 className="break-all text-base font-semibold text-gray-900">
						{build ? build.buildNumber : 'No build'}
						{isCurrent && (
							<span className="ml-2 rounded-full bg-brand-50 px-2 py-0.5 align-middle text-xs font-medium text-brand-700">
								Current
							</span>
						)}
					</h3>
					<p className="text-xs text-gray-500">
						{build ? (
							<>
								Registered{build.createdBy ? ` by ${build.createdBy}` : ''} on{' '}
								<DateDisplay date={build.creationDate} />
							</>
						) : (
							'Test runs created without a build'
						)}
					</p>
				</div>
				<dl className="flex flex-wrap gap-6 text-right">
					<div>
						<dt className="text-xs text-gray-500">Pass rate</dt>
						<dd className="text-xl font-semibold tabular-nums text-gray-900">
							{formatRate(counts.passRate)}
						</dd>
					</div>
					<div>
						<dt className="text-xs text-gray-500">Fail rate</dt>
						<dd className="text-xl font-semibold tabular-nums text-gray-900">
							{formatRate(counts.failRate)}
						</dd>
					</div>
					{results.timeSeconds !== undefined &&
						results.timeSeconds !== null && (
							<div>
								<dt className="text-xs text-gray-500">Time spent</dt>
								<dd className="text-xl font-semibold tabular-nums text-gray-900">
									{formatDuration(results.timeSeconds)}
								</dd>
							</div>
						)}
				</dl>
			</div>

			{testRuns.length === 0 ? (
				<p className="mt-3 text-sm text-gray-500">
					No test runs on this build.
				</p>
			) : (
				<>
					<div className="mt-3">
						<RunProgressBar
							resultCounts={resultCounts(counts)}
							totalCount={counts.testCaseCount}
						/>
					</div>
					<details className="mt-3">
						<summary className="cursor-pointer text-sm font-medium text-gray-700 hover:text-gray-900">
							{testRuns.length} test run{testRuns.length === 1 ? '' : 's'}
						</summary>
						{results.timeline.length > 1 && (
							<div className="mt-3">
								<RateChart
									firstColumn="Test run"
									points={results.timeline.map((point) => ({
										id: point.testRunID,
										label: `#${point.testRunNumber}`,
										title: `#${point.testRunNumber} ${point.title}`,
										counts: point.counts,
									}))}
								/>
							</div>
						)}
						<ul className="mt-3 divide-y divide-gray-200">
							{testRuns.map((testRun) => (
								<li
									key={testRun.testRunID}
									className="grid grid-cols-1 gap-2 py-2 sm:grid-cols-[1fr_auto_12rem] sm:items-center sm:gap-4"
								>
									<Link
										to={Route.viewTestRun(
											projectShortCode,
											testRun.testRunNumber
										)}
										className="min-w-0 truncate text-sm font-medium text-gray-900 hover:text-brand-600 hover:underline"
									>
										#{testRun.testRunNumber} {testRun.title}
									</Link>
									<div className="flex items-center gap-2">
										<TestRunStatusBadge status={testRun.status} />
										<DateDisplay
											date={testRun.creationDate}
											className="text-xs text-gray-500"
										/>
									</div>
									<RunProgressBar
										resultCounts={testRun.resultCounts}
										totalCount={testRun.totalCount}
										showLegend={false}
									/>
								</li>
							))}
						</ul>
					</details>
				</>
			)}
		</section>
	)
}
