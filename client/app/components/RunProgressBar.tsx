import { TestCaseRunStatus } from '~/models/types'

// status colors carry state; every bar is accompanied by a text legend with the counts
const SEGMENTS: {
	status: TestCaseRunStatus
	label: string
	className: string
}[] = [
	{
		status: TestCaseRunStatus.pass,
		label: 'passed',
		className: 'bg-green-500',
	},
	{ status: TestCaseRunStatus.fail, label: 'failed', className: 'bg-red-500' },
	{
		status: TestCaseRunStatus.skip,
		label: 'skipped',
		className: 'bg-amber-400',
	},
	{
		status: TestCaseRunStatus.pending,
		label: 'pending',
		className: 'bg-gray-300',
	},
]

interface RunProgressBarProps {
	resultCounts: Record<TestCaseRunStatus, number>
	totalCount: number
	showLegend?: boolean
}

export function RunProgressBar({
	resultCounts,
	totalCount,
	showLegend = true,
}: RunProgressBarProps) {
	const segments = SEGMENTS.filter(
		(segment) => (resultCounts[segment.status] ?? 0) > 0
	)
	const summary = SEGMENTS.map(
		(segment) => `${resultCounts[segment.status] ?? 0} ${segment.label}`
	).join(', ')

	return (
		<div>
			<div
				className="flex h-2 w-full gap-0.5 overflow-hidden rounded-full bg-gray-100"
				role="img"
				aria-label={summary}
			>
				{totalCount > 0 &&
					segments.map((segment) => {
						const count = resultCounts[segment.status] ?? 0
						return (
							<div
								key={segment.status}
								className={`${segment.className} h-full first:rounded-l-full last:rounded-r-full`}
								style={{ width: `${(count / totalCount) * 100}%` }}
								title={`${count} ${segment.label}`}
							/>
						)
					})}
			</div>
			{showLegend && (
				<div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600">
					{SEGMENTS.map((segment) => (
						<span
							key={segment.status}
							className="inline-flex items-center gap-1.5"
						>
							<span className={`h-2 w-2 rounded-full ${segment.className}`} />
							{resultCounts[segment.status] ?? 0} {segment.label}
						</span>
					))}
				</div>
			)}
		</div>
	)
}
