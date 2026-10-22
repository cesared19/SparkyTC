import { Link, useOutletContext } from '@remix-run/react'
import { ProjectTestPlansOutletContext, TestRun } from '~/models/types'
import { sectionPath } from '~/utility/Sections'
import { planTestCases } from '~/utility/TestPlans'

function plural(count: number, noun: string) {
	return `${count} ${noun}${count === 1 ? '' : 's'}`
}

function chosenSummary(count: number) {
	return count > 0 ? [plural(count, 'chosen test case')] : []
}

function runsSummary(count: number, lastRun: TestRun) {
	return `${plural(count, 'run')}, last #${lastRun.testRunNumber} ${
		lastRun.title
	}`
}

/** The project's test plans: templates of test cases to launch test runs from. */
export default function TestPlans() {
	const { testPlans, testCases, sections, testRuns } =
		useOutletContext<ProjectTestPlansOutletContext>()

	return (
		<div className="space-y-6">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<div>
					<h2 className="text-2xl font-semibold text-gray-900">Test Plans</h2>
					<p className="mt-1 text-sm text-gray-600">
						Templates of test cases, chosen by section, label or one by one, to
						start a test run from whenever there&apos;s a build to test.
					</p>
				</div>
				<Link
					to="new"
					className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
				>
					New Test Plan
				</Link>
			</div>

			{testPlans.length === 0 ? (
				<p className="text-sm text-gray-500">No test plans yet.</p>
			) : (
				<ul className="grid gap-4 md:grid-cols-2">
					{testPlans.map((plan) => {
						const count = planTestCases(plan, testCases, sections).length
						const runs = testRuns.filter(
							(run) => run.testPlanID === plan.testPlanID
						)
						const lastRun = runs.sort(
							(a, b) => b.creationDate - a.creationDate
						)[0]
						const rules = [
							...plan.sectionIDs.map((id) => sectionPath(sections, id)),
							...plan.labels.map((label) => `#${label}`),
							...chosenSummary(plan.testCaseIDs.length),
						]
						return (
							<li key={plan.testPlanID}>
								<Link
									to={plan.testPlanID}
									className="block h-full rounded-lg border border-gray-200 bg-white p-4 hover:border-brand-500"
								>
									<div className="flex items-baseline justify-between gap-3">
										<h3 className="font-semibold text-gray-900">{plan.name}</h3>
										<span className="shrink-0 text-sm tabular-nums text-gray-600">
											{count} test case{count === 1 ? '' : 's'}
										</span>
									</div>
									{plan.description && (
										<p className="mt-1 line-clamp-2 text-sm text-gray-600">
											{plan.description}
										</p>
									)}
									<p className="mt-2 truncate text-xs text-gray-500">
										{rules.join(' · ')}
									</p>
									<p className="mt-1 text-xs text-gray-500">
										{lastRun
											? runsSummary(runs.length, lastRun)
											: 'Not run yet'}
									</p>
								</Link>
							</li>
						)
					})}
				</ul>
			)}
		</div>
	)
}
