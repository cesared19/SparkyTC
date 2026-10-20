import { useFetcher } from '@remix-run/react'
import { useEffect, useState } from 'react'
import {
	ErrorResponse,
	JiraIssue,
	JiraIssueTransition,
	JiraLink,
	JiraTransition,
	JiraUser,
	TestCaseRunStatus,
} from '~/models/types'
import { Route } from '~/utility/Routes'

const SEARCH_DELAY_MS = 300

type Mode = 'close' | 'reopen'

interface Selection {
	checked: boolean
	transitionID?: string
	// a new assignee, only when reopening
	assignee?: JiraUser
}

/** The fetcher key that shares the linked issues' live status with JiraIssuesPanel. */
export function jiraIssuesFetcherKey(testCaseID: string) {
	return `jira-issues-${testCaseID}`
}

/** Done when closing and To Do when reopening, or the first of that category. */
function defaultTransition(transitions: JiraTransition[], mode: Mode) {
	const category = mode === 'close' ? 'done' : 'new'
	const status = mode === 'close' ? 'done' : 'to do'
	const inCategory = transitions.filter(
		(transition) => transition.toStatusCategory === category
	)
	return (
		inCategory.find(
			(transition) => transition.toStatus?.toLowerCase() === status
		) ?? inCategory[0]
	)
}

function transitionLabel(transition: JiraTransition) {
	return transition.toStatus && transition.toStatus !== transition.name
		? `${transition.name} → ${transition.toStatus}`
		: transition.name
}

function AssigneePicker({
	testCaseRunID,
	issue,
	assignee,
	onChange,
}: {
	testCaseRunID: string
	issue: JiraIssue
	assignee?: JiraUser
	onChange: (assignee?: JiraUser) => void
}) {
	const searchFetcher = useFetcher<{ users: JiraUser[]; message?: string }>()
	const [query, setQuery] = useState('')
	const [isSearching, setIsSearching] = useState(false)

	useEffect(() => {
		if (query.trim().length < 2) return
		const timeout = setTimeout(
			() =>
				searchFetcher.load(
					Route.jiraAssignees(testCaseRunID, issue.issueKey, query.trim())
				),
			SEARCH_DELAY_MS
		)
		return () => clearTimeout(timeout)
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [query])

	const results = query.trim().length < 2 ? [] : searchFetcher.data?.users ?? []
	const searchError =
		query.trim().length < 2 ? undefined : searchFetcher.data?.message

	return (
		<div className="space-y-2">
			<div className="flex flex-wrap items-center gap-2 text-sm">
				<span className="text-gray-500">Assignee</span>
				{assignee ? (
					<>
						<span className="font-medium text-gray-900">
							{assignee.displayName}
						</span>
						<button
							type="button"
							onClick={() => onChange(undefined)}
							className="text-xs font-medium text-gray-600 hover:text-gray-900"
						>
							Keep {issue.assigneeName ?? 'unassigned'}
						</button>
					</>
				) : (
					<>
						<span className="text-gray-900">
							{issue.assigneeName ?? 'Unassigned'}
						</span>
						<button
							type="button"
							onClick={() => setIsSearching(!isSearching)}
							className="text-xs font-medium text-brand-600 hover:text-brand-800"
						>
							Change
						</button>
					</>
				)}
			</div>
			{isSearching && !assignee && (
				<div className="max-w-md space-y-2">
					<input
						type="search"
						value={query}
						onChange={(event) => setQuery(event.target.value)}
						placeholder="Search Jira by name or email"
						aria-label={`Search who to assign ${issue.issueKey} to`}
						className="block w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
					/>
					{searchFetcher.state !== 'idle' && (
						<p className="text-xs text-gray-500">Searching...</p>
					)}
					{searchError && <p className="text-xs text-red-600">{searchError}</p>}
					{results.length > 0 && (
						<ul className="divide-y divide-gray-200 rounded-md border border-gray-200 bg-white">
							{results.map((user) => (
								<li
									key={user.accountID}
									className="flex items-center gap-2 px-3 py-2"
								>
									{user.avatarURL && (
										<img
											src={user.avatarURL}
											alt=""
											className="h-6 w-6 shrink-0 rounded-full"
										/>
									)}
									<span className="min-w-0 flex-1">
										<span className="block truncate text-sm text-gray-900">
											{user.displayName}
										</span>
										{user.emailAddress && (
											<span className="block truncate text-xs text-gray-500">
												{user.emailAddress}
											</span>
										)}
									</span>
									<button
										type="button"
										onClick={() => {
											onChange(user)
											setIsSearching(false)
											setQuery('')
										}}
										className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
									>
										Assign
									</button>
								</li>
							))}
						</ul>
					)}
					{query.trim().length >= 2 &&
						searchFetcher.state === 'idle' &&
						searchFetcher.data &&
						!searchError &&
						results.length === 0 && (
							<p className="text-xs text-gray-500">No Jira users found</p>
						)}
				</div>
			)}
		</div>
	)
}

function TransitionRow({
	testCaseRunID,
	issue,
	mode,
	selection,
	disabled,
	onChange,
}: {
	testCaseRunID: string
	issue: JiraIssue
	mode: Mode
	selection: Selection
	disabled: boolean
	onChange: (selection: Selection) => void
}) {
	const transitionsFetcher = useFetcher<
		{ transitions: JiraTransition[] } & Partial<ErrorResponse>
	>()
	const transitions = transitionsFetcher.data?.transitions
	const verb = mode === 'close' ? 'Close' : 'Reopen'

	// the transitions are loaded the first time the issue is checked
	useEffect(() => {
		if (selection.checked && !transitionsFetcher.data) {
			transitionsFetcher.load(
				Route.jiraTransitions(testCaseRunID, issue.issueKey)
			)
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [selection.checked])

	useEffect(() => {
		if (selection.checked && transitions && !selection.transitionID) {
			const transition = defaultTransition(transitions, mode)
			if (transition) {
				onChange({ ...selection, transitionID: transition.transitionID })
			}
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [transitions, selection.checked])

	return (
		<li className="space-y-3 px-3 py-3">
			<div className="flex items-start gap-2 text-sm">
				<input
					id={`jira-${mode}-${issue.issueKey}`}
					type="checkbox"
					checked={selection.checked}
					disabled={disabled}
					onChange={(event) =>
						onChange({ ...selection, checked: event.target.checked })
					}
					className="mt-0.5 h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
				/>
				<label htmlFor={`jira-${mode}-${issue.issueKey}`} className="min-w-0">
					<span className="font-medium text-gray-900">
						{verb} {issue.issueKey} in Jira
					</span>
					<span className="block truncate text-xs text-gray-500">
						{issue.status} · {issue.summary}
					</span>
				</label>
			</div>

			{selection.checked && (
				<div className="ml-6 space-y-3">
					{transitionsFetcher.state !== 'idle' && !transitions && (
						<p className="text-xs text-gray-500">Loading transitions...</p>
					)}
					{transitionsFetcher.data?.message && (
						<p className="text-xs text-red-600">
							{transitionsFetcher.data.message}
						</p>
					)}
					{transitions && transitions.length === 0 && (
						<p className="text-xs text-red-600">
							The Jira account can&apos;t move {issue.issueKey} from{' '}
							{issue.status}.
						</p>
					)}
					{transitions && transitions.length > 0 && (
						<label className="flex flex-wrap items-center gap-2 text-sm">
							<span className="text-gray-500">Transition</span>
							<select
								value={selection.transitionID ?? ''}
								disabled={disabled}
								onChange={(event) =>
									onChange({
										...selection,
										transitionID: event.target.value || undefined,
									})
								}
								className="rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
							>
								<option value="">Choose a transition</option>
								{transitions.map((transition) => (
									<option
										key={transition.transitionID}
										value={transition.transitionID}
									>
										{transitionLabel(transition)}
									</option>
								))}
							</select>
						</label>
					)}
					{mode === 'reopen' && (
						<AssigneePicker
							testCaseRunID={testCaseRunID}
							issue={issue}
							assignee={selection.assignee}
							onChange={(assignee) => onChange({ ...selection, assignee })}
						/>
					)}
				</div>
			)}
		</li>
	)
}

/**
 * Lets the tester close the linked issues that aren't done when recording a pass, or reopen the done ones when
 * recording a fail. SparkyTC then comments on the issue who did it, with a link to this test case run.
 */
export function JiraResultTransitions({
	testCaseRunID,
	testCaseID,
	links,
	status,
	disabled = false,
	onChange,
}: {
	testCaseRunID: string
	testCaseID: string
	links: JiraLink[]
	status: TestCaseRunStatus
	disabled?: boolean
	// undefined while a checked issue has no transition chosen yet
	onChange: (transitions?: JiraIssueTransition[]) => void
}) {
	const issuesFetcher = useFetcher<{ issues: JiraIssue[] } | ErrorResponse>({
		key: jiraIssuesFetcherKey(testCaseID),
	})
	const [selections, setSelections] = useState<Record<string, Selection>>({})

	const mode: Mode | undefined =
		status === TestCaseRunStatus.pass
			? 'close'
			: status === TestCaseRunStatus.fail
			? 'reopen'
			: undefined
	const linkedKeys = links.map((link) => link.issueKey)
	const loadedIssues: JiraIssue[] =
		issuesFetcher.data && 'issues' in issuesFetcher.data
			? issuesFetcher.data.issues
			: []
	const issues = loadedIssues.filter(
		(issue) => linkedKeys.includes(issue.issueKey) && !issue.error
	)
	const eligible = issues.filter((issue) =>
		mode === 'close'
			? issue.statusCategory !== 'done'
			: mode === 'reopen' && issue.statusCategory === 'done'
	)
	const eligibleKeys = eligible.map((issue) => issue.issueKey).join(',')

	useEffect(() => {
		const checked = eligible.filter(
			(issue) => selections[issue.issueKey]?.checked
		)
		if (checked.some((issue) => !selections[issue.issueKey].transitionID)) {
			onChange(undefined)
			return
		}
		onChange(
			checked.map((issue) => {
				const selection = selections[issue.issueKey]
				return {
					issueKey: issue.issueKey,
					transitionID: selection.transitionID as string,
					...(mode === 'reopen' && selection.assignee
						? { assigneeAccountID: selection.assignee.accountID }
						: {}),
				}
			})
		)
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [selections, eligibleKeys, mode])

	// what was chosen for a pass doesn't apply to a fail
	useEffect(() => setSelections({}), [mode])

	if (!mode || eligible.length === 0) return null

	return (
		<div className="mt-4 rounded-md border border-gray-200 bg-white">
			<div className="border-b border-gray-200 px-3 py-2">
				<h3 className="text-sm font-medium text-gray-900">
					{mode === 'close'
						? 'Close linked Jira issues'
						: 'Reopen linked Jira issues'}
				</h3>
				<p className="text-xs text-gray-500">
					When you save, SparkyTC comments on the issue that you{' '}
					{mode === 'close' ? 'closed' : 'reopened'} it, with a link to this
					test case.
				</p>
			</div>
			<ul className="divide-y divide-gray-200">
				{eligible.map((issue) => (
					<TransitionRow
						// the transitions depend on the issue's status
						key={`${mode}-${issue.issueKey}`}
						testCaseRunID={testCaseRunID}
						issue={issue}
						mode={mode}
						selection={selections[issue.issueKey] ?? { checked: false }}
						disabled={disabled}
						onChange={(selection) =>
							setSelections((current) => ({
								...current,
								[issue.issueKey]: selection,
							}))
						}
					/>
				))}
			</ul>
		</div>
	)
}
