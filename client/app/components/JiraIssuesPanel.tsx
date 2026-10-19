import { useFetcher } from '@remix-run/react'
import { useEffect, useState } from 'react'
import {
	CreateJiraIssue,
	ErrorResponse,
	JiraConfiguration,
	JiraFailureMode,
	JiraIssue,
	JiraLink,
	SimilarJiraIssue,
} from '~/models/types'
import { Route } from '~/utility/Routes'
import { ErrorMessage } from './ErrorMessage'

interface JiraIssuesResponse {
	configuration: JiraConfiguration
	issues: JiraIssue[]
}

type ActionResponse = ErrorResponse | { ok: true; issueKey?: string }

interface CreateIssueOptions {
	testCaseRunID: string
	// issues can only be reported for failed test case runs
	isFailed: boolean
	defaults: () => CreateJiraIssue
}

interface JiraIssuesPanelProps {
	testCaseID: string
	links: JiraLink[]
	editable?: boolean
	createIssue?: CreateIssueOptions
	jiraFailureMode?: JiraFailureMode
	// the project's Jira project and issue type, when it doesn't use the default ones
	jiraProjectKey?: string
	jiraIssueType?: string
}

const STATUS_STYLES: Record<string, string> = {
	new: 'bg-gray-100 text-gray-700',
	indeterminate: 'bg-blue-100 text-blue-800',
	done: 'bg-green-100 text-green-800',
}

function errorMessage(data?: ActionResponse | JiraIssuesResponse) {
	return data && 'message' in data ? data.message : undefined
}

export function JiraIssuesPanel({
	testCaseID,
	links,
	editable = false,
	createIssue,
	jiraFailureMode = JiraFailureMode.manual,
	jiraProjectKey,
	jiraIssueType,
}: JiraIssuesPanelProps) {
	const issuesFetcher = useFetcher<JiraIssuesResponse | ErrorResponse>()
	const linkFetcher = useFetcher<ActionResponse>()
	const unlinkFetcher = useFetcher<ActionResponse>()
	const [issueInput, setIssueInput] = useState('')
	// captured when the form opens so later changes on the page don't reset what the user typed
	const [createDefaults, setCreateDefaults] = useState<CreateJiraIssue>()
	const [createdIssueKey, setCreatedIssueKey] = useState<string>()

	const issueKeys = links.map((link) => link.issueKey)
	const issueKeysParam = issueKeys.join(',')

	useEffect(() => {
		issuesFetcher.load(Route.jiraIssues(issueKeys))
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [issueKeysParam])

	useEffect(() => {
		if (
			linkFetcher.state === 'idle' &&
			linkFetcher.data &&
			'ok' in linkFetcher.data
		) {
			setIssueInput('')
		}
	}, [linkFetcher.state, linkFetcher.data])

	const issuesData: JiraIssuesResponse | undefined =
		issuesFetcher.data && 'configuration' in issuesFetcher.data
			? (issuesFetcher.data as JiraIssuesResponse)
			: undefined
	const configuration = issuesData?.configuration
	const isEnabled = configuration?.isEnabled ?? false
	const error =
		errorMessage(issuesFetcher.data) ||
		errorMessage(linkFetcher.data) ||
		errorMessage(unlinkFetcher.data)

	const unlinkingID =
		unlinkFetcher.state !== 'idle'
			? unlinkFetcher.formAction?.split('/').pop()
			: undefined
	const visibleLinks = links.filter((link) => link.linkID !== unlinkingID)

	const linkIssue = (issue: string) =>
		linkFetcher.submit(
			{ issue },
			{
				method: 'post',
				action: Route.testCaseJiraLinks(testCaseID),
				encType: 'application/json',
			}
		)

	const handleLink = (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault()
		if (!issueInput.trim()) return
		linkIssue(issueInput.trim())
	}

	const handleUnlink = (link: JiraLink) => {
		if (
			!confirm(
				`Unlink ${link.issueKey} from this test case? The Jira issue is not modified.`
			)
		) {
			return
		}
		unlinkFetcher.submit(null, {
			method: 'delete',
			action: Route.jiraLink(link.linkID),
		})
	}

	return (
		<div className="space-y-3">
			{error && <ErrorMessage message={error} />}

			{createdIssueKey && (
				<p className="rounded-md bg-green-50 p-3 text-sm text-green-800">
					Created {createdIssueKey} in Jira and linked it to this test case
				</p>
			)}

			{visibleLinks.length === 0 ? (
				<p className="text-sm text-gray-500">No Jira issues linked</p>
			) : (
				<ul className="divide-y divide-gray-200 rounded-md border border-gray-200 bg-white">
					{visibleLinks.map((link) => {
						const issue = issuesData?.issues.find(
							(issue) => issue.issueKey === link.issueKey
						)
						return (
							<li
								key={link.linkID}
								className="flex flex-wrap items-center gap-3 px-3 py-2 text-sm"
							>
								<a
									href={link.issueURL}
									target="_blank"
									rel="noopener noreferrer"
									className="font-medium text-brand-600 hover:text-brand-800 hover:underline"
								>
									{link.issueKey}
								</a>
								<span className="min-w-0 flex-1 truncate text-gray-700">
									{issue?.summary ??
										issue?.error ??
										(isEnabled && issuesFetcher.state !== 'idle'
											? 'Loading...'
											: '')}
								</span>
								{issue?.status && (
									<span
										className={`rounded-full px-2 py-0.5 text-xs font-medium ${
											STATUS_STYLES[issue.statusCategory ?? ''] ??
											STATUS_STYLES.new
										}`}
									>
										{issue.status}
									</span>
								)}
								{editable && (
									<button
										type="button"
										onClick={() => handleUnlink(link)}
										className="text-xs text-red-600 hover:text-red-800"
									>
										Unlink
									</button>
								)}
							</li>
						)
					})}
				</ul>
			)}

			{configuration && !isEnabled && (
				<p className="text-xs text-gray-500">
					The Jira integration is not configured. Set JIRA_BASE_URL, JIRA_EMAIL
					and JIRA_API_TOKEN in the backend service to link and create issues.
				</p>
			)}

			{isEnabled && editable && (
				<form onSubmit={handleLink} className="flex flex-wrap gap-2">
					<input
						type="text"
						value={issueInput}
						onChange={(event) => setIssueInput(event.target.value)}
						placeholder={`Link existing issue, e.g. ${
							jiraProjectKey ?? configuration?.projectKey
						}-123 or its URL`}
						aria-label="Jira issue key or URL"
						className="min-w-[16rem] flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
					/>
					<button
						type="submit"
						disabled={linkFetcher.state !== 'idle' || !issueInput.trim()}
						className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
					>
						{linkFetcher.state !== 'idle' ? 'Linking...' : 'Link'}
					</button>
				</form>
			)}

			{isEnabled &&
				createIssue &&
				jiraFailureMode === JiraFailureMode.automatic && (
					<p className="text-xs text-gray-500">
						This project creates a Jira issue automatically when a failed result
						is saved.
					</p>
				)}

			{isEnabled &&
				createIssue &&
				jiraFailureMode === JiraFailureMode.manual &&
				!createDefaults && (
					<div className="flex items-center gap-3">
						<button
							type="button"
							onClick={() => {
								setCreatedIssueKey(undefined)
								setCreateDefaults(createIssue.defaults())
							}}
							disabled={!createIssue.isFailed}
							className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
						>
							Create bug in Jira
						</button>
						{!createIssue.isFailed && (
							<span className="text-xs text-gray-500">
								Select Fail to report a bug for this test case
							</span>
						)}
					</div>
				)}

			{isEnabled && createIssue && createDefaults && configuration && (
				<CreateJiraIssueForm
					projectKey={jiraProjectKey ?? configuration.projectKey}
					issueType={jiraIssueType ?? configuration.issueType}
					linkedKeys={issueKeys}
					onLinkExisting={(issueKey) => {
						linkIssue(issueKey)
						setCreateDefaults(undefined)
					}}
					testCaseRunID={createIssue.testCaseRunID}
					defaults={createDefaults}
					onCancel={() => setCreateDefaults(undefined)}
					onCreated={(issueKey) => {
						setCreateDefaults(undefined)
						setCreatedIssueKey(issueKey)
					}}
				/>
			)}
		</div>
	)
}

interface CreateJiraIssueFormProps {
	projectKey?: string
	issueType?: string
	linkedKeys: string[]
	onLinkExisting: (issueKey: string) => void
	testCaseRunID: string
	defaults: CreateJiraIssue
	onCancel: () => void
	onCreated: (issueKey?: string) => void
}

function CreateJiraIssueForm({
	projectKey,
	issueType,
	linkedKeys,
	onLinkExisting,
	testCaseRunID,
	defaults,
	onCancel,
	onCreated,
}: CreateJiraIssueFormProps) {
	const fetcher = useFetcher<ActionResponse>()
	const similarFetcher = useFetcher<{ issues: SimilarJiraIssue[] }>()
	const isSubmitting = fetcher.state !== 'idle'
	const error = errorMessage(fetcher.data)

	const searchSimilar = (summary: string) => {
		if (summary.trim()) {
			similarFetcher.load(Route.similarJiraIssues(testCaseRunID, summary))
		}
	}

	useEffect(() => {
		searchSimilar(defaults.summary)
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [])

	const similarIssues = (similarFetcher.data?.issues ?? []).filter(
		(issue) => !linkedKeys.includes(issue.issueKey)
	)

	useEffect(() => {
		if (fetcher.state === 'idle' && fetcher.data && 'ok' in fetcher.data) {
			onCreated(fetcher.data.issueKey)
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [fetcher.state, fetcher.data])

	const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault()
		const formData = new FormData(event.currentTarget)
		const jiraIssue: CreateJiraIssue = {
			summary: formData.get('summary') as string,
			stepsToReproduce: formData.get('stepsToReproduce') as string,
			expectedResult: formData.get('expectedResult') as string,
			actualResult: formData.get('actualResult') as string,
			buildNumber: formData.get('buildNumber') as string,
		}

		fetcher.submit(
			{ intent: 'createJiraIssue', testCaseRunID, jiraIssue },
			{ method: 'post', encType: 'application/json' }
		)
	}

	const inputClassName =
		'mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500'

	const fields: {
		name:
			| 'summary'
			| 'stepsToReproduce'
			| 'expectedResult'
			| 'actualResult'
			| 'buildNumber'
		label: string
		rows?: number
	}[] = [
		{ name: 'summary', label: 'Summary' },
		{ name: 'stepsToReproduce', label: 'Steps to reproduce', rows: 5 },
		{ name: 'expectedResult', label: 'Expected result', rows: 2 },
		{ name: 'actualResult', label: 'Actual result', rows: 2 },
		{ name: 'buildNumber', label: 'Build number' },
	]

	return (
		<form
			onSubmit={handleSubmit}
			className="space-y-4 rounded-md border border-red-200 bg-red-50/40 p-4"
		>
			<div>
				<h3 className="text-base font-semibold text-gray-900">
					New {issueType} in {projectKey}
				</h3>
				<p className="mt-1 text-xs text-gray-500">
					Images and videos are not uploaded to Jira, the issue links to them in
					SparkyTC instead
				</p>
			</div>

			{error && <ErrorMessage message={error} />}

			{similarIssues.length > 0 && (
				<div className="rounded-md border border-yellow-200 bg-yellow-50 p-3">
					<p className="text-sm font-medium text-yellow-800">
						Similar issues already in Jira. Link one instead of creating a
						duplicate?
					</p>
					<ul className="mt-2 space-y-1">
						{similarIssues.map((issue) => (
							<li
								key={issue.issueKey}
								className="flex flex-wrap items-center gap-2 text-sm"
							>
								<a
									href={issue.issueURL}
									target="_blank"
									rel="noopener noreferrer"
									className="font-medium text-brand-600 hover:underline"
								>
									{issue.issueKey}
								</a>
								<span className="min-w-0 flex-1 truncate text-gray-700">
									{issue.summary}
								</span>
								{issue.status && (
									<span className="text-xs text-gray-500">{issue.status}</span>
								)}
								<button
									type="button"
									onClick={() => onLinkExisting(issue.issueKey)}
									className="rounded-md border border-gray-300 bg-white px-2 py-0.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
								>
									Link instead
								</button>
							</li>
						))}
					</ul>
				</div>
			)}

			{fields.map((field) => (
				<div key={field.name}>
					<label
						htmlFor={`jira-${field.name}`}
						className="block text-sm font-medium text-gray-700"
					>
						{field.label}
					</label>
					{field.rows ? (
						<textarea
							id={`jira-${field.name}`}
							name={field.name}
							rows={field.rows}
							required
							defaultValue={defaults[field.name]}
							className={inputClassName}
						/>
					) : (
						<input
							id={`jira-${field.name}`}
							name={field.name}
							type="text"
							required
							defaultValue={defaults[field.name]}
							// look for similar issues again once the summary is edited
							onBlur={
								field.name === 'summary'
									? (event) => searchSimilar(event.target.value)
									: undefined
							}
							className={inputClassName}
						/>
					)}
				</div>
			))}

			<div className="flex justify-end gap-3">
				<button
					type="button"
					onClick={onCancel}
					className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
				>
					Cancel
				</button>
				<button
					type="submit"
					disabled={isSubmitting}
					className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
				>
					{isSubmitting ? 'Creating...' : 'Create issue'}
				</button>
			</div>
		</form>
	)
}
