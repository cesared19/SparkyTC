import { useFetcher, useOutletContext } from '@remix-run/react'
import { useEffect, useState } from 'react'
import { BackButton } from '~/components/BackButton'
import { ErrorMessage } from '~/components/ErrorMessage'
import { EditableStep, emptyStep, StepsEditor } from '~/components/StepsEditor'
import {
	ErrorResponse,
	ProjectTestCasesOutletContext,
	SharedStep,
} from '~/models/types'
import { Route } from '~/utility/Routes'

function SharedStepEditor({
	projectShortCode,
	sharedStep,
	onClose,
}: {
	projectShortCode: string
	// undefined creates a new one
	sharedStep?: SharedStep
	onClose: () => void
}) {
	const fetcher = useFetcher<ErrorResponse | { ok: true }>()
	const [name, setName] = useState(sharedStep?.name ?? '')
	const [steps, setSteps] = useState<EditableStep[]>(() => {
		const items = sharedStep?.items ?? [{ action: '', expected: '' }]
		return items.map((item) => emptyStep(item.action, item.expected ?? ''))
	})
	const error =
		fetcher.data && 'message' in fetcher.data ? fetcher.data.message : undefined

	useEffect(() => {
		if (fetcher.state === 'idle' && fetcher.data && 'ok' in fetcher.data) {
			onClose()
		}
	}, [fetcher.state, fetcher.data, onClose])

	return (
		<form
			className="space-y-3 rounded-md border border-gray-200 bg-gray-50 p-4"
			onSubmit={(event) => {
				event.preventDefault()
				fetcher.submit(
					{
						intent: sharedStep ? 'update' : 'create',
						projectShortCode,
						sharedStepID: sharedStep?.sharedStepID ?? null,
						name,
						items: steps.map((step) => ({
							action: step.action,
							expected: step.expected,
						})),
					},
					{
						method: 'post',
						action: Route.sharedSteps,
						encType: 'application/json',
					}
				)
			}}
		>
			{error && <ErrorMessage message={error} />}
			<label className="block text-sm font-medium text-gray-700">
				Name
				<input
					value={name}
					onChange={(event) => setName(event.target.value)}
					required
					maxLength={200}
					placeholder="e.g. Sign in as a tester"
					className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
				/>
			</label>
			<StepsEditor steps={steps} onChange={setSteps} allowShared={false} />
			{sharedStep && sharedStep.usageCount > 0 && (
				<p className="text-xs text-gray-500">
					Saving changes the {sharedStep.usageCount} test case
					{sharedStep.usageCount === 1 ? '' : 's'} that use it. Test runs
					already created keep their copy.
				</p>
			)}
			<div className="flex justify-end gap-2">
				<button
					type="button"
					onClick={onClose}
					className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
				>
					Cancel
				</button>
				<button
					type="submit"
					disabled={fetcher.state !== 'idle'}
					className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
				>
					{fetcher.state !== 'idle' ? 'Saving...' : 'Save shared step'}
				</button>
			</div>
		</form>
	)
}

function SharedStepCard({
	projectShortCode,
	sharedStep,
}: {
	projectShortCode: string
	sharedStep: SharedStep
}) {
	const deleteFetcher = useFetcher<ErrorResponse | { ok: true }>()
	const [isEditing, setIsEditing] = useState(false)
	const error =
		deleteFetcher.data && 'message' in deleteFetcher.data
			? deleteFetcher.data.message
			: undefined

	if (isEditing) {
		return (
			<li>
				<SharedStepEditor
					projectShortCode={projectShortCode}
					sharedStep={sharedStep}
					onClose={() => setIsEditing(false)}
				/>
			</li>
		)
	}

	return (
		<li className="rounded-md border border-gray-200 bg-white p-4">
			<div className="flex flex-wrap items-baseline justify-between gap-2">
				<h3 className="font-medium text-gray-900">{sharedStep.name}</h3>
				<div className="flex items-center gap-3 text-xs">
					<span className="text-gray-500">
						Used by {sharedStep.usageCount} test case
						{sharedStep.usageCount === 1 ? '' : 's'}
					</span>
					<button
						type="button"
						onClick={() => setIsEditing(true)}
						className="font-medium text-brand-600 hover:text-brand-800"
					>
						Edit
					</button>
					<button
						type="button"
						disabled={deleteFetcher.state !== 'idle'}
						onClick={() => {
							if (confirm(`Delete the shared step ${sharedStep.name}?`)) {
								deleteFetcher.submit(
									{ intent: 'delete', sharedStepID: sharedStep.sharedStepID },
									{
										method: 'post',
										action: Route.sharedSteps,
										encType: 'application/json',
									}
								)
							}
						}}
						className="font-medium text-red-600 hover:text-red-800"
					>
						Delete
					</button>
				</div>
			</div>
			{error && (
				<div className="mt-2">
					<ErrorMessage message={error} />
				</div>
			)}
			<ol className="mt-2 list-decimal space-y-1 pl-6 text-sm text-gray-700">
				{sharedStep.items.map((item, index) => (
					<li key={index}>
						{item.action}
						{item.expected && (
							<span className="text-gray-500"> → {item.expected}</span>
						)}
					</li>
				))}
			</ol>
		</li>
	)
}

/** The project's shared steps: steps reused by several test cases, edited in one place. */
export default function SharedSteps() {
	const { project, sharedSteps } =
		useOutletContext<ProjectTestCasesOutletContext>()
	const [isCreating, setIsCreating] = useState(false)

	return (
		<div className="space-y-6">
			<BackButton />
			<div className="flex flex-wrap items-center justify-between gap-3">
				<div>
					<h2 className="text-2xl font-semibold text-gray-900">Shared steps</h2>
					<p className="mt-1 text-sm text-gray-600">
						Steps that several test cases use, such as signing in. Test cases
						written as steps insert them as a block, and editing one here
						changes every test case that uses it.
					</p>
				</div>
				{!isCreating && (
					<button
						type="button"
						onClick={() => setIsCreating(true)}
						className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
					>
						New shared step
					</button>
				)}
			</div>

			{isCreating && (
				<SharedStepEditor
					projectShortCode={project.projectShortCode}
					onClose={() => setIsCreating(false)}
				/>
			)}

			{sharedSteps.length === 0 && !isCreating ? (
				<p className="text-sm text-gray-500">No shared steps yet.</p>
			) : (
				<ul className="space-y-3">
					{sharedSteps.map((sharedStep) => (
						<SharedStepCard
							key={sharedStep.sharedStepID}
							projectShortCode={project.projectShortCode}
							sharedStep={sharedStep}
						/>
					))}
				</ul>
			)}
		</div>
	)
}
