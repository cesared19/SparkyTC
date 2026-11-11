import { TestCaseAttachment } from '~/models/types'
import { Route } from '~/utility/Routes'
import {
	formatMetric,
	REGRESSION_PERCENT,
	REPLAY_METRICS,
	type ReplayMetric,
	type ReplayReport,
	type ReplayScreenshot,
	screenshotFiles,
	worsePercent,
} from '~/utility/ReplayReport'
import { Table, type Column } from './Table'

function Verdict({ passed, label }: { passed?: boolean; label?: string }) {
	if (passed === undefined) return <span className="text-gray-500">—</span>
	return (
		<span
			className={`inline-flex rounded-full px-2 text-xs font-semibold leading-5 ${
				passed ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
			}`}
		>
			{label ?? (passed ? 'Match' : 'Different')}
		</span>
	)
}

type MetricRow = { metric: ReplayMetric; recorded?: number; replay?: number }

/**
 * The report an app sent with a result: for re-Play, the replay's findings, each screenshot compared with the
 * recording (with links to its images in the evidence) and its performance next to the recording's.
 */
export function ReplayReportView({
	report,
	attachments,
}: {
	report: ReplayReport
	attachments: TestCaseAttachment[]
}) {
	const screenshotColumns: Column<ReplayScreenshot>[] = [
		{
			header: 'Screenshot',
			key: 'name',
			mobile: 'title',
			render: (shot) => (
				<span className="whitespace-normal break-all">{shot.name}</span>
			),
		},
		{
			header: 'Different',
			key: 'differentPercent',
			render: (shot) =>
				shot.differentPercent === undefined
					? '—'
					: `${shot.differentPercent.toFixed(
							shot.differentPercent < 1 ? 3 : 1
						)}% of pixels`,
		},
		{
			header: 'Result',
			key: 'passed',
			render: (shot) => <Verdict passed={shot.passed} />,
		},
		{
			header: 'Images',
			key: 'images',
			render: (shot) => {
				const files = screenshotFiles(shot.name, attachments)
				if (files.length === 0)
					return <span className="text-gray-500">Not in the evidence</span>
				return (
					<span className="flex flex-wrap gap-x-3 gap-y-1">
						{files.map(({ attachment, label }) => (
							<a
								key={attachment.attachmentID}
								href={Route.attachment(attachment.attachmentID)}
								target="_blank"
								rel="noopener noreferrer"
								onClick={(event) => event.stopPropagation()}
								className="text-brand-600 hover:underline"
							>
								{label}
							</a>
						))}
					</span>
				)
			},
		},
	]

	const metricRows: MetricRow[] = REPLAY_METRICS.map((metric) => ({
		metric,
		recorded: report.recorded?.[metric.key],
		replay: report.replay?.[metric.key],
	})).filter((row) => row.recorded !== undefined || row.replay !== undefined)

	const metricColumns: Column<MetricRow>[] = [
		{
			header: 'Metric',
			key: 'metric',
			mobile: 'title',
			render: (row) => row.metric.label,
		},
		{
			header: 'Recording',
			key: 'recorded',
			render: (row) => formatMetric(row.metric, row.recorded),
		},
		{
			header: 'Replay',
			key: 'replay',
			render: (row) => {
				const worse = worsePercent(row.metric, row.recorded, row.replay)
				const regression = worse !== undefined && worse > REGRESSION_PERCENT
				return (
					<span
						className={regression ? 'font-semibold text-red-700' : undefined}
						title={
							regression
								? `More than ${REGRESSION_PERCENT}% worse than the recording`
								: undefined
						}
					>
						{formatMetric(row.metric, row.replay)}
						{worse !== undefined && Math.abs(worse) >= 0.05 && (
							<span
								className={`ml-2 text-xs ${
									regression
										? 'text-red-700'
										: worse > 0
											? 'text-gray-500'
											: 'text-green-700'
								}`}
							>
								{Math.abs(worse).toFixed(0)}% {worse > 0 ? 'worse' : 'better'}
							</span>
						)}
					</span>
				)
			},
		},
	]

	return (
		<section
			aria-label="Replay report"
			className="space-y-4 rounded-md border border-gray-200 bg-white p-3 sm:p-4"
		>
			<div className="flex flex-wrap items-center gap-2">
				<h4 className="text-sm font-semibold text-gray-900">Replay report</h4>
				<Verdict
					passed={report.passed}
					label={report.passed ? 'Passed' : 'Failed'}
				/>
			</div>

			{report.findings.length > 0 && (
				<ul className="list-disc space-y-1 pl-5 text-sm text-gray-800">
					{report.findings.map((finding, index) => (
						<li key={index}>{finding}</li>
					))}
				</ul>
			)}

			{report.screenshots.length > 0 && (
				<div>
					<h5 className="mb-1 text-xs font-medium uppercase tracking-wider text-gray-500">
						Screenshots
					</h5>
					<Table
						tableRows={report.screenshots.map((shot, index) => ({
							id: `${index}-${shot.name}`,
							data: shot,
						}))}
						columns={screenshotColumns}
					/>
				</div>
			)}

			{metricRows.length > 0 && (
				<div>
					<h5 className="mb-1 text-xs font-medium uppercase tracking-wider text-gray-500">
						Performance
					</h5>
					<Table
						tableRows={metricRows.map((row) => ({
							id: row.metric.key,
							data: row,
						}))}
						columns={metricColumns}
					/>
				</div>
			)}
		</section>
	)
}
