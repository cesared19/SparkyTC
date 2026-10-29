import { Link, useSearchParams } from '@remix-run/react'
import { Project } from '~/models/project'
import { TestCaseRun } from '~/models/types'
import { TestCaseRunStatusBadge } from '~/components/TestCaseRunStatusBadge'
import { Route } from '~/utility/Routes'
import { Tools } from '~/utility/Tools'

// the test case number whose result was just saved, set when moving on after saving
export const SAVED_PARAM = 'saved'

/** Confirms the result just saved, after moving on to the next test case or back to the run. */
export function SavedResultNotice({
	project,
	testRunNumber,
	testCaseRuns,
}: {
	project: Project
	testRunNumber: number
	testCaseRuns: TestCaseRun[]
}) {
	const [searchParams, setSearchParams] = useSearchParams()
	const savedNumber = Number(searchParams.get(SAVED_PARAM))
	const saved = testCaseRuns.find(
		(run) => run.testCase.testCaseNumber === savedNumber
	)
	if (!saved) return null

	const dismiss = () => {
		const next = new URLSearchParams(searchParams)
		next.delete(SAVED_PARAM)
		setSearchParams(next, { replace: true, preventScrollReset: true })
	}

	return (
		<div
			role="status"
			className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800"
		>
			<span>
				Result saved for{' '}
				<Link
					to={Route.viewTestCaseRun(
						project.projectShortCode,
						testRunNumber,
						savedNumber
					)}
					className="font-medium underline"
				>
					{Tools.testCaseDisplayCode(project, saved.testCase)} {saved.title}
				</Link>
			</span>
			<TestCaseRunStatusBadge status={saved.status} />
			<button
				type="button"
				onClick={dismiss}
				aria-label="Dismiss"
				className="ml-auto text-green-800 hover:text-green-900"
			>
				×
			</button>
		</div>
	)
}

/** The page to go to after saving, telling it which result was saved. */
export function withSavedResult(url: string, testCaseNumber: number) {
	return `${url}${
		url.includes('?') ? '&' : '?'
	}${SAVED_PARAM}=${testCaseNumber}`
}
