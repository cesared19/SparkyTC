import {
	StepResult,
	TestCaseFormat,
	TestCaseRun,
	TestCaseRunStatus,
	TestCaseRunStep,
	TestCaseStep,
} from '~/models/types'
import { LinkifiedText } from './LinkifiedText'
import { TestCaseRunStatusBadge } from './TestCaseRunStatusBadge'

/** The steps of a test case, with shared steps shown as a titled block. */
export function TestCaseStepsView({ steps }: { steps: TestCaseStep[] }) {
	let number = 0
	return (
		<ol className="space-y-2">
			{steps.map((step) => {
				if (step.sharedStep) {
					return (
						<li
							key={step.stepID}
							className="rounded-md border border-gray-200 bg-gray-50 p-2"
						>
							<div className="mb-1 text-xs font-medium text-gray-500">
								Shared step: {step.sharedStep.name}
							</div>
							<ol className="space-y-1">
								{step.sharedStep.items.map((item, index) => (
									<StepRow
										key={index}
										number={++number}
										action={item.action}
										expected={item.expected}
									/>
								))}
							</ol>
						</li>
					)
				}
				return (
					<StepRow
						key={step.stepID}
						number={++number}
						action={step.action ?? ''}
						expected={step.expected}
					/>
				)
			})}
		</ol>
	)
}

function StepRow({
	number,
	action,
	expected,
}: {
	number: number
	action: string
	expected?: string
}) {
	return (
		<li className="grid grid-cols-[2rem_1fr] gap-x-2 text-sm sm:grid-cols-[2rem_1fr_1fr]">
			<span className="text-right font-medium tabular-nums text-gray-500">
				{number}.
			</span>
			<div className="whitespace-pre-wrap text-gray-900">
				<LinkifiedText text={action} />
			</div>
			<div className="col-start-2 whitespace-pre-wrap text-gray-600 sm:col-start-3">
				{expected && (
					<>
						<span className="text-xs font-medium text-gray-500">
							Expected:{' '}
						</span>
						<LinkifiedText text={expected} />
					</>
				)}
			</div>
		</li>
	)
}

const STEP_STATUSES = [
	{
		status: TestCaseRunStatus.pass,
		label: 'Pass',
		active: 'bg-green-100 text-green-800 ring-1 ring-green-600',
	},
	{
		status: TestCaseRunStatus.fail,
		label: 'Fail',
		active: 'bg-red-100 text-red-800 ring-1 ring-red-600',
	},
	{
		status: TestCaseRunStatus.blocked,
		label: 'Blocked',
		active: 'bg-violet-100 text-violet-800 ring-1 ring-violet-600',
	},
	{
		status: TestCaseRunStatus.skip,
		label: 'Skip',
		active: 'bg-cyan-100 text-cyan-800 ring-1 ring-cyan-600',
	},
]

/**
 * The result a test case's steps point to: failed if any step failed, then blocked, then passed once every
 * step passed or was skipped. Undefined until the steps say something.
 */
export function suggestedResult(
	steps: TestCaseRunStep[],
	results: Record<string, StepResult>
): TestCaseRunStatus | undefined {
	const statuses = steps.map((step) => results[step.stepID]?.status)
	if (statuses.includes(TestCaseRunStatus.fail)) return TestCaseRunStatus.fail
	if (statuses.includes(TestCaseRunStatus.blocked)) {
		return TestCaseRunStatus.blocked
	}
	if (statuses.length > 0 && statuses.every((status) => !!status)) {
		return statuses.every((status) => status === TestCaseRunStatus.skip)
			? TestCaseRunStatus.skip
			: TestCaseRunStatus.pass
	}
	return undefined
}

/** The steps of a test case in a run, each marked as it's tested, with what actually happened. */
export function RunStepsChecklist({
	steps,
	results,
	onChange,
	disabled = false,
}: {
	steps: TestCaseRunStep[]
	results: Record<string, StepResult>
	onChange: (results: Record<string, StepResult>) => void
	disabled?: boolean
}) {
	const update = (stepID: string, change: Partial<StepResult>) =>
		onChange({
			...results,
			[stepID]: { ...(results[stepID] ?? { stepID }), ...change },
		})

	return (
		<ol className="space-y-3">
			{steps.map((step, index) => {
				const result = results[step.stepID]
				const startsShared =
					step.sharedStepName &&
					step.sharedStepName !== steps[index - 1]?.sharedStepName
				return (
					<li key={step.stepID}>
						{startsShared && (
							<div className="mb-1 text-xs font-medium text-gray-500">
								Shared step: {step.sharedStepName}
							</div>
						)}
						<div className="rounded-md border border-gray-200 bg-white p-3">
							<div className="grid grid-cols-[2rem_1fr] gap-x-2 text-sm">
								<span className="text-right font-medium tabular-nums text-gray-500">
									{index + 1}.
								</span>
								<div>
									<div className="whitespace-pre-wrap text-gray-900">
										<LinkifiedText text={step.action} />
									</div>
									{step.expected && (
										<div className="mt-1 whitespace-pre-wrap text-gray-600">
											<span className="text-xs font-medium text-gray-500">
												Expected:{' '}
											</span>
											<LinkifiedText text={step.expected} />
										</div>
									)}
								</div>
							</div>
							<fieldset
								disabled={disabled}
								className="mt-2 flex flex-wrap items-center gap-2 pl-10 disabled:opacity-50"
							>
								<legend className="sr-only">Result of step {index + 1}</legend>
								{STEP_STATUSES.map((option) => (
									<button
										key={option.status}
										type="button"
										aria-pressed={result?.status === option.status}
										onClick={() =>
											update(step.stepID, {
												// clicking the chosen status again clears it
												status:
													result?.status === option.status
														? undefined
														: option.status,
											})
										}
										className={`rounded-md px-2.5 py-1 text-xs font-medium ${
											result?.status === option.status
												? option.active
												: 'bg-gray-50 text-gray-700 hover:bg-gray-100'
										}`}
									>
										{option.label}
									</button>
								))}
								<input
									aria-label={`Actual result of step ${index + 1}`}
									value={result?.actual ?? ''}
									onChange={(event) =>
										update(step.stepID, { actual: event.target.value })
									}
									placeholder="Actual result (optional)"
									className="min-w-[12rem] flex-1 rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
								/>
							</fieldset>
						</div>
					</li>
				)
			})}
		</ol>
	)
}

/** The steps as numbered text, with how each went, e.g. for the steps to reproduce of a Jira issue. */
export function runStepsText(
	steps: TestCaseRunStep[],
	results: Record<string, StepResult> = {}
) {
	return steps
		.map((step, index) => {
			const result = results[step.stepID]
			const lines = [`${index + 1}. ${step.action}`]
			if (step.expected) lines.push(`   Expected: ${step.expected}`)
			if (result?.actual?.trim())
				lines.push(`   Actual: ${result.actual.trim()}`)
			if (result?.status) lines.push(`   Result: ${result.status}`)
			return lines.join('\n')
		})
		.join('\n')
}

/** How each step went in a recorded result. */
export function StepResultsSummary({
	steps,
	stepResults,
}: {
	steps: TestCaseRunStep[]
	stepResults: StepResult[]
}) {
	if (stepResults.length === 0) return null
	return (
		<ol className="space-y-1 text-sm">
			{steps.map((step, index) => {
				const result = stepResults.find((item) => item.stepID === step.stepID)
				return (
					<li key={step.stepID} className="flex flex-wrap items-baseline gap-2">
						<span className="w-6 shrink-0 text-right text-xs tabular-nums text-gray-500">
							{index + 1}.
						</span>
						{result?.status ? (
							<TestCaseRunStatusBadge status={result.status} />
						) : (
							<span className="text-xs text-gray-400">Not marked</span>
						)}
						<span className="min-w-0 flex-1 truncate text-gray-700">
							{step.action}
						</span>
						{result?.actual && (
							<span className="basis-full pl-8 text-xs text-gray-600">
								Actual: {result.actual}
							</span>
						)}
					</li>
				)
			})}
		</ol>
	)
}

/** The step results of a test case's latest result, in the order of its steps. */
export function latestStepResults(testCaseRun: TestCaseRun) {
	const latest = testCaseRun.results[testCaseRun.results.length - 1]
	const stepResults = latest?.stepResults ?? []
	return (testCaseRun.steps ?? []).map((step) => ({
		step,
		result: stepResults.find((item) => item.stepID === step.stepID),
	}))
}

const STEP_SUMMARY_ORDER: { status: TestCaseRunStatus; label: string }[] = [
	{ status: TestCaseRunStatus.fail, label: 'failed' },
	{ status: TestCaseRunStatus.blocked, label: 'blocked' },
	{ status: TestCaseRunStatus.skip, label: 'skipped' },
]

/** e.g. "4/5 passed · 1 failed", or undefined before a result with steps. */
export function stepResultsSummaryText(testCaseRun: TestCaseRun) {
	if (testCaseRun.format !== TestCaseFormat.steps) return undefined
	const latest = latestStepResults(testCaseRun)
	if (latest.every(({ result }) => !result?.status)) return undefined
	const count = (status: TestCaseRunStatus) =>
		latest.filter(({ result }) => result?.status === status).length
	const parts = [`${count(TestCaseRunStatus.pass)}/${latest.length} passed`]
	for (const { status, label } of STEP_SUMMARY_ORDER) {
		if (count(status) > 0) parts.push(`${count(status)} ${label}`)
	}
	return parts.join(' · ')
}
