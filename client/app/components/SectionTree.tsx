import { useFetcher } from '@remix-run/react'
import { useEffect, useState } from 'react'
import { ErrorMessage } from '~/components/ErrorMessage'
import { SectionSelect } from '~/components/SectionSelect'
import { ErrorResponse, TestCase, TestCaseSection } from '~/models/types'
import { Route } from '~/utility/Routes'
import {
	SectionNode,
	sectionAndDescendants,
	sectionTree,
} from '~/utility/Sections'

type Editing =
	| { mode: 'rename' | 'add' | 'move'; sectionID: string }
	| { mode: 'suite' }

const inputClassName =
	'block w-full rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500'

const smallButtonClassName =
	'rounded-md border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50'

function NameForm({
	initialName = '',
	label,
	onSave,
	onCancel,
	disabled,
}: {
	initialName?: string
	label: string
	onSave: (name: string) => void
	onCancel: () => void
	disabled: boolean
}) {
	const [name, setName] = useState(initialName)
	return (
		<form
			className="mt-1 flex gap-1"
			onSubmit={(event) => {
				event.preventDefault()
				if (name.trim()) onSave(name.trim())
			}}
		>
			<input
				// eslint-disable-next-line jsx-a11y/no-autofocus
				autoFocus
				aria-label={label}
				value={name}
				maxLength={200}
				onChange={(event) => setName(event.target.value)}
				onKeyDown={(event) => event.key === 'Escape' && onCancel()}
				className={inputClassName}
			/>
			<button
				type="submit"
				disabled={disabled}
				className={smallButtonClassName}
			>
				Save
			</button>
			<button type="button" onClick={onCancel} className={smallButtonClassName}>
				Cancel
			</button>
		</form>
	)
}

/**
 * The project's suites and nested sections, with how many test cases each holds. Selecting one shows its test
 * cases; each section can get subsections, be renamed, moved, reordered or deleted once empty.
 */
export function SectionTree({
	projectShortCode,
	sections,
	testCases,
	selectedID,
	onSelect,
}: {
	projectShortCode: string
	sections: TestCaseSection[]
	testCases: TestCase[]
	// undefined shows every test case
	selectedID?: string
	onSelect: (sectionID?: string) => void
}) {
	const fetcher = useFetcher<ErrorResponse | { ok: true }>()
	const [editing, setEditing] = useState<Editing>()
	const [menuFor, setMenuFor] = useState<string>()
	const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
	const [moveTo, setMoveTo] = useState('')
	const isSaving = fetcher.state !== 'idle'
	const error =
		fetcher.data && 'message' in fetcher.data ? fetcher.data.message : undefined

	// a finished change closes its form
	useEffect(() => {
		if (fetcher.state === 'idle' && fetcher.data && 'ok' in fetcher.data) {
			setEditing(undefined)
		}
	}, [fetcher.state, fetcher.data])

	const submit = (body: Record<string, string | null>) => {
		setMenuFor(undefined)
		fetcher.submit(body, {
			method: 'post',
			action: Route.sections,
			encType: 'application/json',
		})
	}

	// counts include the test cases of nested sections
	const countFor = (sectionID: string) => {
		const ids = sectionAndDescendants(sections, sectionID)
		return testCases.filter(
			(testCase) => testCase.sectionID && ids.has(testCase.sectionID)
		).length
	}

	const renderNode = (node: SectionNode, siblings: SectionNode[]) => {
		const { section } = node
		const isSelected = selectedID === section.sectionID
		const isCollapsed = collapsed.has(section.sectionID)
		const index = siblings.indexOf(node)
		const isEditing =
			editing &&
			'sectionID' in editing &&
			editing.sectionID === section.sectionID

		return (
			<li key={section.sectionID}>
				<div
					className={`group flex items-center gap-1 rounded-md pr-1 ${
						isSelected ? 'bg-brand-50' : 'hover:bg-gray-50'
					}`}
					style={{ paddingLeft: `${node.depth * 14}px` }}
				>
					<button
						type="button"
						aria-label={isCollapsed ? 'Expand' : 'Collapse'}
						onClick={() =>
							setCollapsed((current) => {
								const next = new Set(current)
								if (next.has(section.sectionID)) next.delete(section.sectionID)
								else next.add(section.sectionID)
								return next
							})
						}
						className={`flex h-6 w-5 shrink-0 items-center justify-center text-gray-400 hover:text-gray-700 ${
							node.children.length === 0 ? 'invisible' : ''
						}`}
					>
						<svg
							className={`h-3 w-3 transition-transform ${
								isCollapsed ? '' : 'rotate-90'
							}`}
							viewBox="0 0 20 20"
							fill="currentColor"
							aria-hidden="true"
						>
							<path d="M7 5l6 5-6 5z" />
						</svg>
					</button>
					<button
						type="button"
						onClick={() => onSelect(section.sectionID)}
						className={`min-w-0 flex-1 truncate py-1.5 text-left text-sm ${
							isSelected
								? 'font-medium text-brand-700'
								: node.depth === 0
								? 'font-medium text-gray-900'
								: 'text-gray-700'
						}`}
						title={section.name}
					>
						{section.name}
					</button>
					<span className="shrink-0 text-xs tabular-nums text-gray-500">
						{countFor(section.sectionID)}
					</span>
					<button
						type="button"
						aria-label={`Actions for ${section.name}`}
						aria-expanded={menuFor === section.sectionID}
						onClick={() =>
							setMenuFor(
								menuFor === section.sectionID ? undefined : section.sectionID
							)
						}
						className="shrink-0 rounded px-1 text-gray-500 hover:bg-gray-100 hover:text-gray-900"
					>
						⋯
					</button>
				</div>

				{menuFor === section.sectionID && (
					<div
						className="my-1 flex flex-wrap gap-1"
						style={{ paddingLeft: `${node.depth * 14 + 20}px` }}
					>
						<button
							type="button"
							className={smallButtonClassName}
							onClick={() => {
								setMenuFor(undefined)
								setEditing({ mode: 'add', sectionID: section.sectionID })
							}}
						>
							Add section
						</button>
						<button
							type="button"
							className={smallButtonClassName}
							onClick={() => {
								setMenuFor(undefined)
								setEditing({ mode: 'rename', sectionID: section.sectionID })
							}}
						>
							Rename
						</button>
						<button
							type="button"
							className={smallButtonClassName}
							onClick={() => {
								setMenuFor(undefined)
								setMoveTo(section.parentID ?? '')
								setEditing({ mode: 'move', sectionID: section.sectionID })
							}}
						>
							Move
						</button>
						<button
							type="button"
							className={smallButtonClassName}
							disabled={index === 0 || isSaving}
							onClick={() =>
								submit({
									intent: 'reorder',
									sectionID: section.sectionID,
									direction: 'up',
								})
							}
						>
							Up
						</button>
						<button
							type="button"
							className={smallButtonClassName}
							disabled={index === siblings.length - 1 || isSaving}
							onClick={() =>
								submit({
									intent: 'reorder',
									sectionID: section.sectionID,
									direction: 'down',
								})
							}
						>
							Down
						</button>
						<button
							type="button"
							className={`${smallButtonClassName} text-red-600`}
							disabled={isSaving}
							onClick={() => {
								if (
									confirm(
										`Delete ${section.name}? Only empty sections can be deleted.`
									)
								) {
									if (isSelected) onSelect(undefined)
									submit({ intent: 'delete', sectionID: section.sectionID })
								}
							}}
						>
							Delete
						</button>
					</div>
				)}

				{isEditing && (
					<div style={{ paddingLeft: `${node.depth * 14 + 20}px` }}>
						{editing.mode === 'rename' && (
							<NameForm
								label={`New name for ${section.name}`}
								initialName={section.name}
								disabled={isSaving}
								onCancel={() => setEditing(undefined)}
								onSave={(name) =>
									submit({
										intent: 'update',
										sectionID: section.sectionID,
										name,
										parentID: section.parentID ?? null,
									})
								}
							/>
						)}
						{editing.mode === 'add' && (
							<NameForm
								label={`Name of the new section in ${section.name}`}
								disabled={isSaving}
								onCancel={() => setEditing(undefined)}
								onSave={(name) =>
									submit({
										intent: 'create',
										projectShortCode,
										name,
										parentID: section.sectionID,
									})
								}
							/>
						)}
						{editing.mode === 'move' && (
							<form
								className="mt-1 flex flex-wrap gap-1"
								onSubmit={(event) => {
									event.preventDefault()
									submit({
										intent: 'update',
										sectionID: section.sectionID,
										name: section.name,
										parentID: moveTo || null,
									})
								}}
							>
								<SectionSelect
									sections={sections}
									value={moveTo}
									onChange={setMoveTo}
									emptyLabel="Top level (as a suite)"
									excludeIDs={sectionAndDescendants(
										sections,
										section.sectionID
									)}
									className="min-w-0 flex-1 py-1"
								/>
								<button
									type="submit"
									disabled={isSaving}
									className={smallButtonClassName}
								>
									Move
								</button>
								<button
									type="button"
									onClick={() => setEditing(undefined)}
									className={smallButtonClassName}
								>
									Cancel
								</button>
							</form>
						)}
					</div>
				)}

				{!isCollapsed && node.children.length > 0 && (
					<ul>
						{node.children.map((child) => renderNode(child, node.children))}
					</ul>
				)}
			</li>
		)
	}

	const tree = sectionTree(sections)

	return (
		<div className="space-y-2">
			{error && <ErrorMessage message={error} />}
			<button
				type="button"
				onClick={() => onSelect(undefined)}
				className={`flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm ${
					selectedID === undefined
						? 'bg-brand-50 font-medium text-brand-700'
						: 'text-gray-900 hover:bg-gray-50'
				}`}
			>
				All test cases
				<span className="text-xs tabular-nums text-gray-500">
					{testCases.length}
				</span>
			</button>
			<ul>{tree.map((node) => renderNode(node, tree))}</ul>
			{editing?.mode === 'suite' ? (
				<NameForm
					label="Name of the new suite"
					disabled={isSaving}
					onCancel={() => setEditing(undefined)}
					onSave={(name) =>
						submit({ intent: 'create', projectShortCode, name })
					}
				/>
			) : (
				<button
					type="button"
					onClick={() => setEditing({ mode: 'suite' })}
					className="text-xs font-medium text-brand-600 hover:text-brand-800"
				>
					+ New suite
				</button>
			)}
		</div>
	)
}
