import { TestCaseRunStatus } from '~/models/types'

export function TestCaseRunStatusBadge({
	status,
}: {
	status: TestCaseRunStatus
}) {
	switch (status) {
		case TestCaseRunStatus.pending:
			return (
				<span className="inline-flex rounded-full px-2 text-xs font-semibold leading-5 bg-gray-100 text-gray-800">
					PENDING
				</span>
			)
		case TestCaseRunStatus.pass:
			return (
				<span className="inline-flex rounded-full px-2 text-xs font-semibold leading-5 bg-green-100 text-green-800">
					PASS
				</span>
			)
		case TestCaseRunStatus.fail:
			return (
				<span className="inline-flex rounded-full px-2 text-xs font-semibold leading-5 bg-red-100 text-red-800">
					FAIL
				</span>
			)
		case TestCaseRunStatus.skip:
			return (
				<span className="inline-flex rounded-full px-2 text-xs font-semibold leading-5 bg-cyan-100 text-cyan-800">
					SKIP
				</span>
			)
		case TestCaseRunStatus.blocked:
			return (
				<span className="inline-flex rounded-full px-2 text-xs font-semibold leading-5 bg-violet-100 text-violet-800">
					BLOCKED
				</span>
			)
	}
}
