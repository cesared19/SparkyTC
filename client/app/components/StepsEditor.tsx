import { useState } from 'react'
import { SharedStep, StepInput, TestCaseStep } from '~/models/types'

// a step being edited; when sharedStepID is set, it's a shared step and the action and expected are unused
export interface EditableStep {
	key: string
	action: string
	expected: string
	sharedStepID?: string
}

let nextKey = 0
const newKey = () => `step-${nextKey++}`

export function emptyStep(action = '', expected = ''): EditableStep {
	return { key: newKey(), action, expected }
}

export function stepsFromTestCase(steps?: TestCaseStep[]): EditableStep[] {
	return (steps ?? []).map((step) =>
		step.sharedStep
			? { ...emptyStep(), sharedStepID: step.sharedStep.sharedStepID }
			: emptyStep(step.action ?? '', step.expected ?? '')
	)
}

export function toStepInputs(steps: EditableStep[]): StepInput[] {
	return steps.map((step) =>
		step.sharedStepID
			? { sharedStepID: step.sharedStepID }
			: { action: step.action, expected: step.expected }
	)
}

/** The steps as numbered text, e.g. when a test case goes back to free text. */
export function stepsAsText(steps: EditableStep[], sharedSteps: SharedStep[]) {
	const lines: { action: string; expected?: string }[] = steps.flatMap((step) =>
		step.sharedStepID
			? sharedSteps.find((shared) => shared.sharedStepID === step.sharedStepID)
					?.items ?? []
			: [{ action: step.action, expected: step.expected }]
	)
	return lines
		.filter((line) => line.action.trim())
		.map(
			(line, index) =>
				`${index + 1}. ${line.action.trim()}${
					line.expected?.trim() ? `\n   Expected: ${line.expected.trim()}` : ''
				}`
		)
		.join('\n')
}

const textareaClassName =
	'block w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500'

const iconButtonClassName =
	'rounded px-1.5 py-0.5 text-xs text-gray-500 hover:bg-gray-100 hover:text-gray-900 disabled:opacity-30'

/**
 * Steps with an action and an expected result each, which can be reordered and removed. Shared steps are
 * inserted as a block and edited in the shared step library.
 */
export function StepsEditor({
	steps,
	onChange,
	sharedSteps = [],
	allowShared = true,
}: {
	steps: EditableStep[]
	onChange: (steps: EditableStep[]) => void
	sharedSteps?: SharedStep[]
	// a shared step's own steps can't contain other shared steps
	allowShared?: boolean
}) {
	const [sharedToInsert, setSharedToInsert] = useState('')

	const update = (index: number, step: EditableStep) =>
		onChange(steps.map((current, i) => (i === index ? step : current)))
	const move = (index: number, offset: number) => {
		const next = [...steps]
		const [step] = next.splice(index, 1)
		next.splice(index + offset, 0, step)
		onChange(next)
	}

	return (
		<div className="space-y-2">
			{steps.length === 0 && (
				<p className="text-sm text-gray-500">No steps yet.</p>
			)}
			<ol className="space-y-2">
				{steps.map((step, index) => {
					const shared = sharedSteps.find(
						(candidate) =>
							!!step.sharedStepID &&
							candidate.sharedStepID === step.sharedStepID
					)
					return (
						<li
							key={step.key}
							className="flex gap-2 rounded-md border border-gray-200 bg-white p-2"
						>
							<span className="mt-1.5 w-6 shrink-0 text-right text-sm font-medium tabular-nums text-gray-500">
								{index + 1}.
							</span>
							{step.sharedStepID ? (
								<div className="min-w-0 flex-1 rounded-md bg-gray-50 px-2 py-1.5">
									<div className="text-sm font-medium text-gray-900">
										{shared?.name ?? 'Shared step no longer available'}
										<span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
											Shared
										</span>
									</div>
									<ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs text-gray-600">
										{shared?.items.map((item, itemIndex) => (
											<li key={itemIndex}>
												{item.action}
												{item.expected && (
													<span className="text-gray-500">
														{' '}
														→ {item.expected}
													</span>
												)}
											</li>
										))}
									</ul>
								</div>
							) : (
								<div className="grid min-w-0 flex-1 grid-cols-1 gap-2 sm:grid-cols-2">
									<label className="text-xs font-medium text-gray-500">
										Action
										<textarea
											rows={2}
											value={step.action}
											onChange={(event) =>
												update(index, { ...step, action: event.target.value })
											}
											className={`mt-0.5 ${textareaClassName}`}
										/>
									</label>
									<label className="text-xs font-medium text-gray-500">
										Expected result
										<textarea
											rows={2}
											value={step.expected}
											onChange={(event) =>
												update(index, { ...step, expected: event.target.value })
											}
											className={`mt-0.5 ${textareaClassName}`}
										/>
									</label>
								</div>
							)}
							<div className="flex shrink-0 flex-col items-center">
								<button
									type="button"
									aria-label={`Move step ${index + 1} up`}
									disabled={index === 0}
									onClick={() => move(index, -1)}
									className={iconButtonClassName}
								>
									↑
								</button>
								<button
									type="button"
									aria-label={`Move step ${index + 1} down`}
									disabled={index === steps.length - 1}
									onClick={() => move(index, 1)}
									className={iconButtonClassName}
								>
									↓
								</button>
								<button
									type="button"
									aria-label={`Remove step ${index + 1}`}
									onClick={() => onChange(steps.filter((_, i) => i !== index))}
									className={`${iconButtonClassName} text-red-600`}
								>
									×
								</button>
							</div>
						</li>
					)
				})}
			</ol>
			<div className="flex flex-wrap items-center gap-2">
				<button
					type="button"
					onClick={() => onChange([...steps, emptyStep()])}
					className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
				>
					Add step
				</button>
				{allowShared && sharedSteps.length > 0 && (
					<span className="flex flex-wrap items-center gap-2">
						<select
							aria-label="Shared step to insert"
							value={sharedToInsert}
							onChange={(event) => setSharedToInsert(event.target.value)}
							className="rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
						>
							<option value="">Choose a shared step</option>
							{sharedSteps.map((shared) => (
								<option key={shared.sharedStepID} value={shared.sharedStepID}>
									{shared.name} ({shared.items.length} steps)
								</option>
							))}
						</select>
						<button
							type="button"
							disabled={!sharedToInsert}
							onClick={() => {
								onChange([
									...steps,
									{ ...emptyStep(), sharedStepID: sharedToInsert },
								])
								setSharedToInsert('')
							}}
							className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
						>
							Insert shared step
						</button>
					</span>
				)}
			</div>
		</div>
	)
}
