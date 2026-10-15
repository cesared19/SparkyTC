import { useFetcher } from '@remix-run/react'
import { useEffect, useState } from 'react'
import {
	ErrorResponse,
	TestCaseRun,
	TestRun,
	TestRunStatus,
	UserSummary,
} from '~/models/types'
import { useCurrentUser, useIsAdmin } from '~/utility/CurrentUser'
import { Route } from '~/utility/Routes'

export function isTestRunClosed(testRun: TestRun) {
	return (
		testRun.status === TestRunStatus.complete ||
		testRun.status === TestRunStatus.abort
	)
}

interface AssigneePickerProps {
	users: UserSummary[]
	selectedIDs: string[]
	onChange: (userIDs: string[]) => void
}

/** Checkbox list of the users that can see the project. */
export function AssigneePicker({
	users,
	selectedIDs,
	onChange,
}: AssigneePickerProps) {
	const toggle = (userID: string) =>
		onChange(
			selectedIDs.includes(userID)
				? selectedIDs.filter((id) => id !== userID)
				: [...selectedIDs, userID]
		)

	return (
		<div className="flex flex-wrap gap-2">
			{users.map((user) => {
				const selected = selectedIDs.includes(user.userID)
				return (
					<label
						key={user.userID}
						className={`inline-flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1 text-sm ${
							selected
								? 'border-brand-600 bg-brand-50 text-brand-700'
								: 'border-gray-300 text-gray-700 hover:bg-gray-50'
						}`}
					>
						<input
							type="checkbox"
							className="sr-only"
							checked={selected}
							onChange={() => toggle(user.userID)}
						/>
						{user.displayName}
					</label>
				)
			})}
			{users.length === 0 && (
				<p className="text-sm text-gray-500">No users can see this project</p>
			)}
		</div>
	)
}

interface TestRunAssigneesProps {
	testRun: TestRun
	projectUsers: UserSummary[]
}

/** The users responsible for a test run; admins can change them while it's open. */
export function TestRunAssignees({
	testRun,
	projectUsers,
}: TestRunAssigneesProps) {
	const isAdmin = useIsAdmin()
	const fetcher = useFetcher<ErrorResponse | { ok: true }>()
	const [isEditing, setIsEditing] = useState(false)
	const [selectedIDs, setSelectedIDs] = useState(
		testRun.assignees.map((user) => user.userID)
	)
	const canEdit = isAdmin && !isTestRunClosed(testRun)

	useEffect(() => {
		if (fetcher.state === 'idle' && fetcher.data && 'ok' in fetcher.data) {
			setIsEditing(false)
		}
	}, [fetcher.state, fetcher.data])

	if (isEditing) {
		return (
			<div className="space-y-3">
				<AssigneePicker
					users={projectUsers}
					selectedIDs={selectedIDs}
					onChange={setSelectedIDs}
				/>
				{fetcher.data && 'message' in fetcher.data && (
					<p className="text-sm text-red-600">{fetcher.data.message}</p>
				)}
				<div className="flex gap-2">
					<button
						type="button"
						disabled={fetcher.state !== 'idle'}
						onClick={() =>
							fetcher.submit(
								{
									intent: 'testRunAssignees',
									testRunID: testRun.testRunID,
									userIDs: selectedIDs,
								},
								{
									method: 'post',
									action: Route.assignments,
									encType: 'application/json',
								}
							)
						}
						className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
					>
						{fetcher.state !== 'idle' ? 'Saving...' : 'Save'}
					</button>
					<button
						type="button"
						onClick={() => setIsEditing(false)}
						className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
					>
						Cancel
					</button>
				</div>
			</div>
		)
	}

	return (
		<div className="flex flex-wrap items-center gap-2">
			{testRun.assignees.length === 0 ? (
				<span className="text-sm text-gray-500">Nobody assigned</span>
			) : (
				testRun.assignees.map((user) => (
					<span
						key={user.userID}
						className="rounded-full bg-gray-100 px-3 py-1 text-sm text-gray-700"
					>
						{user.displayName}
					</span>
				))
			)}
			{canEdit && (
				<button
					type="button"
					onClick={() => {
						setSelectedIDs(testRun.assignees.map((user) => user.userID))
						setIsEditing(true)
					}}
					className="text-sm font-medium text-brand-600 hover:text-brand-700"
				>
					Edit
				</button>
			)}
		</div>
	)
}

interface TestCaseAssignmentProps {
	testRun: TestRun
	testCaseRun: TestCaseRun
	projectUsers: UserSummary[]
	compact?: boolean
}

/**
 * Who is working on a test case. Testers take an available test case or give back their own;
 * admins assign it to anyone while the test run is open.
 */
export function TestCaseAssignment({
	testRun,
	testCaseRun,
	projectUsers,
	compact = false,
}: TestCaseAssignmentProps) {
	const currentUser = useCurrentUser()
	const isAdmin = useIsAdmin()
	const fetcher = useFetcher<ErrorResponse | { ok: true }>()
	const isOpen = !isTestRunClosed(testRun)

	// show the pending change right away
	const pending = fetcher.json as { userID?: string | null } | undefined
	const assignee =
		pending !== undefined
			? projectUsers.find((user) => user.userID === pending.userID)
			: testCaseRun.assignedTo
	const isMine = assignee?.userID === currentUser?.userID

	const assign = (userID: string | null) =>
		fetcher.submit(
			{
				intent: 'testCaseRunAssignee',
				testCaseRunID: testCaseRun.testCaseRunID,
				userID,
			},
			{ method: 'post', action: Route.assignments, encType: 'application/json' }
		)

	// the run's assignees come first when an admin picks someone
	const runAssigneeIDs = new Set(testRun.assignees.map((user) => user.userID))
	const options = [...projectUsers].sort(
		(a, b) =>
			Number(runAssigneeIDs.has(b.userID)) -
			Number(runAssigneeIDs.has(a.userID))
	)

	const buttonClassName =
		'rounded-md border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50'

	return (
		<div
			className={`flex flex-wrap items-center gap-2 ${
				compact ? '' : 'text-sm'
			}`}
			onClick={(event) => event.stopPropagation()}
			role="presentation"
		>
			{isAdmin && isOpen ? (
				<select
					value={assignee?.userID ?? ''}
					onChange={(event) => assign(event.target.value || null)}
					aria-label={`Assignee for ${testCaseRun.title}`}
					className="rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
				>
					<option value="">Unassigned</option>
					{options.map((user) => (
						<option key={user.userID} value={user.userID}>
							{user.displayName}
						</option>
					))}
				</select>
			) : (
				<span className={assignee ? 'text-gray-900' : 'text-gray-500'}>
					{assignee ? (isMine ? 'You' : assignee.displayName) : 'Unassigned'}
				</span>
			)}
			{!isAdmin && isOpen && !assignee && (
				<button
					type="button"
					disabled={fetcher.state !== 'idle'}
					onClick={() => assign(currentUser?.userID ?? null)}
					className={buttonClassName}
				>
					Take
				</button>
			)}
			{!isAdmin && isOpen && isMine && (
				<button
					type="button"
					disabled={fetcher.state !== 'idle'}
					onClick={() => assign(null)}
					className={buttonClassName}
				>
					Release
				</button>
			)}
			{fetcher.data && 'message' in fetcher.data && (
				<span className="text-xs text-red-600">{fetcher.data.message}</span>
			)}
		</div>
	)
}
