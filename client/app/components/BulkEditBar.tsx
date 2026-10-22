import { useFetcher } from '@remix-run/react'
import { useState } from 'react'
import { LabelFilter, LabelInput, projectLabels } from '~/components/LabelInput'
import { SectionSelect } from '~/components/SectionSelect'
import {
	BulkEditResult,
	ErrorResponse,
	PropertyConfiguration,
	PropertyType,
	TestCase,
	TestCaseFormat,
	TestCaseRun,
	TestCaseSection,
	UserSummary,
} from '~/models/types'
import { Route } from '~/utility/Routes'

type BulkResponse =
	| ErrorResponse
	| { ok: true; intent: string; result: BulkEditResult }

type Action = 'move' | 'addLabels' | 'removeLabels' | 'property' | 'format'

const ACTIONS: { value: Action | 'delete'; label: string }[] = [
	{ value: 'move', label: 'Move to section' },
	{ value: 'addLabels', label: 'Add labels' },
	{ value: 'removeLabels', label: 'Remove labels' },
	{ value: 'property', label: 'Set a property' },
	{ value: 'format', label: 'Change format' },
]

const fieldClassName =
	'rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500'
const applyClassName =
	'rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50'

const plural = (count: number) => `${count} test case${count === 1 ? '' : 's'}`

function resultMessage(intent: string, result: BulkEditResult) {
	if (intent !== 'delete') return `Updated ${plural(result.updated)}`
	const parts = []
	if (result.deleted > 0) parts.push(`deleted ${plural(result.deleted)}`)
	// test cases used in test runs are archived so the runs keep their results
	if (result.archived > 0) parts.push(`archived ${plural(result.archived)}`)
	const text = parts.join(' and ')
	return text.charAt(0).toUpperCase() + text.slice(1)
}

/** Sends a bulk change and reports how it went; the page reloads its data afterwards. */
function useBulkFetcher() {
	const fetcher = useFetcher<BulkResponse>()
	const data = fetcher.state === 'idle' ? fetcher.data : undefined
	const error = data && 'message' in data ? data.message : undefined
	const message =
		data && 'ok' in data ? resultMessage(data.intent, data.result) : undefined
	const send = (body: Record<string, unknown>) => {
		fetcher.submit(JSON.stringify(body), {
			method: 'post',
			action: Route.bulkEdit,
			encType: 'application/json',
		})
	}
	return { send, error, message, isBusy: fetcher.state !== 'idle' }
}

function BarShell({
	count,
	onClear,
	error,
	message,
	hint,
	children,
}: {
	count: number
	onClear: () => void
	error?: string
	message?: string
	// a note under the actions
	hint?: string
	children: React.ReactNode
}) {
	return (
		<div className="sticky bottom-0 z-10 -mx-4 mt-4 border-t border-gray-200 bg-white px-4 py-3 shadow-lg sm:mx-0 sm:rounded-md sm:border">
			<div className="flex flex-wrap items-center gap-2">
				<span className="text-sm font-medium text-gray-900">
					{count} selected
				</span>
				{children}
				<button
					type="button"
					onClick={onClear}
					className="ml-auto text-sm text-gray-500 hover:text-gray-900"
				>
					Clear selection
				</button>
			</div>
			{hint && <p className="mt-2 text-xs text-gray-500">{hint}</p>}
			{error && <p className="mt-2 text-sm text-red-600">{error}</p>}
			{message && !error && (
				<p className="mt-2 text-sm text-green-700" role="status">
					{message}
				</p>
			)}
		</div>
	)
}

/** The actions for the chosen test cases of the list: move, labels, a property, the format and, for admins, delete. */
export function BulkEditBar({
	selected,
	testCases,
	sections,
	properties,
	isAdmin,
	onClear,
}: {
	selected: TestCase[]
	// every test case of the project, for the label suggestions
	testCases: TestCase[]
	sections: TestCaseSection[]
	properties: PropertyConfiguration[]
	isAdmin: boolean
	onClear: () => void
}) {
	const { send, error, message, isBusy } = useBulkFetcher()
	const [action, setAction] = useState<Action | 'delete'>('move')
	const [sectionID, setSectionID] = useState(sections[0]?.sectionID ?? '')
	const [labels, setLabels] = useState<string[]>([])
	const [propertyID, setPropertyID] = useState(
		properties[0]?.propertyConfigurationID ?? ''
	)
	const [propertyValue, setPropertyValue] = useState('')
	const [format, setFormat] = useState<TestCaseFormat>(TestCaseFormat.steps)

	const property = properties.find(
		(candidate) => candidate.propertyConfigurationID === propertyID
	)
	const testCaseIDs = selected.map((testCase) => testCase.testCaseID)
	const actions = isAdmin
		? [...ACTIONS, { value: 'delete' as const, label: 'Delete' }]
		: ACTIONS

	const chooseAction = (next: Action | 'delete') => {
		setAction(next)
		setLabels([])
	}

	const apply = () => {
		switch (action) {
			case 'move':
				return send({ intent: 'edit', testCaseIDs, sectionID })
			case 'addLabels':
				return send({ intent: 'edit', testCaseIDs, addLabels: labels })
			case 'removeLabels':
				return send({ intent: 'edit', testCaseIDs, removeLabels: labels })
			case 'property':
				return send({ intent: 'edit', testCaseIDs, propertyID, propertyValue })
			case 'format':
				return send({ intent: 'edit', testCaseIDs, format })
			case 'delete':
				if (
					window.confirm(
						`Delete ${plural(
							selected.length
						)}? The ones used in test runs are archived so the runs keep their results.`
					)
				) {
					send({ intent: 'delete', testCaseIDs })
				}
		}
	}

	const formatHint =
		format === TestCaseFormat.steps
			? 'Test cases without steps start with one step made from their instructions.'
			: 'Test cases without instructions get their steps written as numbered text.'
	const needsLabels = action === 'addLabels' || action === 'removeLabels'
	const canApply = selected.length > 0 && (!needsLabels || labels.length > 0)

	return (
		<BarShell
			count={selected.length}
			onClear={onClear}
			error={error}
			message={message}
			hint={action === 'format' ? formatHint : undefined}
		>
			<select
				value={action}
				onChange={(event) =>
					chooseAction(event.target.value as Action | 'delete')
				}
				aria-label="Bulk action"
				className={fieldClassName}
			>
				{actions.map((option) => (
					<option key={option.value} value={option.value}>
						{option.label}
					</option>
				))}
			</select>

			{action === 'move' && (
				<SectionSelect
					sections={sections}
					value={sectionID}
					onChange={setSectionID}
					className="bg-white"
				/>
			)}
			{action === 'addLabels' && (
				<div className="w-full sm:w-72">
					<LabelInput
						id="bulkLabels"
						labels={labels}
						suggestions={projectLabels(testCases)}
						onChange={setLabels}
					/>
				</div>
			)}
			{action === 'removeLabels' && (
				<RemoveLabels
					selected={selected}
					chosen={labels}
					onChange={setLabels}
				/>
			)}
			{action === 'property' && (
				<>
					<select
						value={propertyID}
						onChange={(event) => {
							setPropertyID(event.target.value)
							setPropertyValue('')
						}}
						aria-label="Property"
						className={fieldClassName}
					>
						{properties.map((candidate) => (
							<option
								key={candidate.propertyConfigurationID}
								value={candidate.propertyConfigurationID}
							>
								{candidate.title}
							</option>
						))}
					</select>
					{property && (
						<PropertyValueInput
							property={property}
							value={propertyValue}
							onChange={setPropertyValue}
						/>
					)}
				</>
			)}
			{action === 'format' && (
				<select
					value={format}
					onChange={(event) => setFormat(event.target.value as TestCaseFormat)}
					aria-label="Format"
					className={fieldClassName}
				>
					<option value={TestCaseFormat.steps}>Steps</option>
					<option value={TestCaseFormat.text}>Text</option>
				</select>
			)}

			<button
				type="button"
				onClick={apply}
				disabled={!canApply || isBusy}
				className={
					action === 'delete'
						? 'rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50'
						: applyClassName
				}
			>
				{isBusy ? 'Applying...' : 'Apply'}
			</button>
		</BarShell>
	)
}

/** The labels of the chosen test cases, to pick the ones to take off. */
function RemoveLabels({
	selected,
	chosen,
	onChange,
}: {
	selected: TestCase[]
	chosen: string[]
	onChange: (labels: string[]) => void
}) {
	const labels = projectLabels(selected)
	if (labels.length === 0) {
		return (
			<span className="text-sm text-gray-500">
				The selected test cases have no labels
			</span>
		)
	}
	return <LabelFilter labels={labels} selected={chosen} onChange={onChange} />
}

function PropertyValueInput({
	property,
	value,
	onChange,
}: {
	property: PropertyConfiguration
	value: string
	onChange: (value: string) => void
}) {
	if (property.propertyType === PropertyType.singleSelectList) {
		return (
			<select
				value={value}
				onChange={(event) => onChange(event.target.value)}
				aria-label={`Value for ${property.title}`}
				className={fieldClassName}
			>
				<option value="">{property.isRequired ? 'Choose' : 'No value'}</option>
				{(property.selectOptions ?? []).map((option) => (
					<option key={option} value={option}>
						{option}
					</option>
				))}
			</select>
		)
	}
	return (
		<input
			type={property.propertyType === PropertyType.number ? 'number' : 'text'}
			value={value}
			onChange={(event) => onChange(event.target.value)}
			placeholder={property.isRequired ? 'Value' : 'Empty clears it'}
			aria-label={`Value for ${property.title}`}
			className={fieldClassName}
		/>
	)
}

/** Assigns the chosen test cases of an open run to a user, or leaves them unassigned. */
export function BulkAssignBar({
	selected,
	users,
	onClear,
}: {
	selected: TestCaseRun[]
	users: UserSummary[]
	onClear: () => void
}) {
	const { send, error, message, isBusy } = useBulkFetcher()
	const [userID, setUserID] = useState('')
	return (
		<BarShell
			count={selected.length}
			onClear={onClear}
			error={error}
			message={message}
		>
			<label htmlFor="bulkAssignee" className="text-sm text-gray-700">
				Assign to
			</label>
			<select
				id="bulkAssignee"
				value={userID}
				onChange={(event) => setUserID(event.target.value)}
				className={fieldClassName}
			>
				<option value="">Unassigned</option>
				{users.map((user) => (
					<option key={user.userID} value={user.userID}>
						{user.displayName}
					</option>
				))}
			</select>
			<button
				type="button"
				disabled={selected.length === 0 || isBusy}
				onClick={() =>
					send({
						intent: 'assign',
						testCaseRunIDs: selected.map((run) => run.testCaseRunID),
						userID: userID || null,
					})
				}
				className={applyClassName}
			>
				{isBusy ? 'Applying...' : 'Apply'}
			</button>
		</BarShell>
	)
}

/** A button that turns selection on and off. */
export function SelectToggle({
	isSelecting,
	onChange,
}: {
	isSelecting: boolean
	onChange: (isSelecting: boolean) => void
}) {
	return (
		<button
			type="button"
			onClick={() => onChange(!isSelecting)}
			aria-pressed={isSelecting}
			className={`rounded-md border px-4 py-2 text-sm font-medium ${
				isSelecting
					? 'border-brand-600 bg-brand-50 text-brand-700'
					: 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
			}`}
		>
			{isSelecting ? 'Done selecting' : 'Select'}
		</button>
	)
}
