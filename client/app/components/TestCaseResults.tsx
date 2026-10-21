import { Link, useFetcher } from '@remix-run/react'
import { useEffect } from 'react'
import { AttachmentGallery } from '~/components/AttachmentGallery'
import { LinkifiedText } from '~/components/LinkifiedText'
import { TestCaseRunStatusBadge } from '~/components/TestCaseRunStatusBadge'
import {
	ErrorResponse,
	TestCaseHistoryEntry,
	TestCaseResult,
	TestCaseRun,
} from '~/models/types'
import { useCurrentUser, useIsAdmin } from '~/utility/CurrentUser'
import { Route } from '~/utility/Routes'
import { ErrorMessage } from './ErrorMessage'

function formatDateTime(date: number) {
	return new Date(date).toLocaleString('en-US', {
		month: 'short',
		day: 'numeric',
		year: 'numeric',
		hour: 'numeric',
		minute: '2-digit',
	})
}

function ResultItem({
	result,
	isCurrent,
}: {
	result: TestCaseResult
	isCurrent: boolean
}) {
	const currentUser = useCurrentUser()
	const isAdmin = useIsAdmin()
	const deleteFetcher = useFetcher<ErrorResponse | { ok: true }>()
	// evidence is added by whoever recorded the result, or an admin
	const canEditEvidence =
		isAdmin || (!!currentUser && currentUser.userID === result.recordedByID)
	const error =
		deleteFetcher.data && 'message' in deleteFetcher.data
			? deleteFetcher.data.message
			: undefined

	if (deleteFetcher.state !== 'idle') return null

	return (
		<li className="space-y-3 py-4">
			<div className="flex flex-wrap items-center gap-x-3 gap-y-1">
				<TestCaseRunStatusBadge status={result.status} />
				{isCurrent && (
					<span className="rounded-full bg-gray-100 px-2 text-xs font-medium leading-5 text-gray-700">
						Current
					</span>
				)}
				<span className="text-sm text-gray-700">
					{result.recordedBy ?? 'Unknown user'}
				</span>
				<span className="text-xs text-gray-500">
					{formatDateTime(result.recordedAt)}
				</span>
				{isAdmin && (
					<button
						type="button"
						onClick={() => {
							if (
								confirm(
									'Delete this result? Its evidence is deleted too, and the test case goes back to its previous result.'
								)
							) {
								deleteFetcher.submit(null, {
									method: 'delete',
									action: Route.testCaseResult(result.resultID),
								})
							}
						}}
						className="ml-auto text-xs text-red-600 hover:text-red-800"
					>
						Delete result
					</button>
				)}
			</div>
			{error && <ErrorMessage message={error} />}
			{result.notes ? (
				<div className="whitespace-pre-wrap text-sm text-gray-900">
					<LinkifiedText text={result.notes} />
				</div>
			) : (
				<p className="text-sm italic text-gray-500">No comment</p>
			)}
			{(result.attachments.length > 0 || canEditEvidence) && (
				<AttachmentGallery
					attachments={result.attachments}
					uploadAction={Route.resultEvidence(result.resultID)}
					editable={canEditEvidence}
					compact
					emptyMessage="No evidence"
					uploadLabel="Add evidence"
				/>
			)}
		</li>
	)
}

/** Every result recorded for a test case in this run, newest first; the first one is its status. */
export function TestCaseRunResults({
	testCaseRun,
}: {
	testCaseRun: TestCaseRun
}) {
	const results = [...testCaseRun.results].reverse()
	if (results.length === 0) {
		return <p className="text-sm text-gray-500">No results recorded yet</p>
	}
	return (
		<ul className="divide-y divide-gray-200">
			{results.map((result, index) => (
				<ResultItem
					key={result.resultID}
					result={result}
					isCurrent={index === 0}
				/>
			))}
		</ul>
	)
}

/**
 * The results of a test case in the runs of its project, newest first. On a test case run page the current run
 * is left out, as its results are listed above.
 */
export function TestCaseHistory({
	testCaseID,
	projectShortCode,
	testCaseNumber,
	excludeTestRunID,
	limit,
}: {
	testCaseID: string
	projectShortCode: string
	testCaseNumber: number
	excludeTestRunID?: string
	limit?: number
}) {
	const fetcher = useFetcher<
		{ history: TestCaseHistoryEntry[] } & Partial<ErrorResponse>
	>()

	useEffect(() => {
		fetcher.load(Route.testCaseHistory(testCaseID))
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [testCaseID])

	if (!fetcher.data) {
		return <p className="text-sm text-gray-500">Loading history...</p>
	}
	if (fetcher.data.message) {
		return <ErrorMessage message={fetcher.data.message} />
	}

	const entries = fetcher.data.history.filter(
		(entry) => entry.testRunID !== excludeTestRunID
	)
	const shown = limit ? entries.slice(0, limit) : entries
	if (entries.length === 0) {
		return (
			<p className="text-sm text-gray-500">
				{excludeTestRunID
					? 'No results in other test runs'
					: 'This test case has no results yet'}
			</p>
		)
	}

	return (
		<div className="space-y-2">
			<ul className="divide-y divide-gray-200 rounded-md border border-gray-200 bg-white">
				{shown.map((entry) => (
					<li
						key={entry.result.resultID}
						className={`space-y-1 px-3 py-2 text-sm ${
							entry.isLatestInRun ? '' : 'opacity-70'
						}`}
					>
						<div className="flex flex-wrap items-center gap-x-3 gap-y-1">
							<TestCaseRunStatusBadge status={entry.result.status} />
							<Link
								to={Route.viewTestCaseRun(
									projectShortCode,
									entry.testRunNumber,
									testCaseNumber
								)}
								className="min-w-0 truncate font-medium text-gray-900 hover:text-brand-700 hover:underline"
							>
								#{entry.testRunNumber} {entry.testRunTitle}
							</Link>
							{entry.buildNumber && (
								<span className="text-xs text-gray-500">
									Build {entry.buildNumber}
								</span>
							)}
							{!entry.isLatestInRun && (
								<span className="text-xs text-gray-500">Earlier result</span>
							)}
						</div>
						<div className="flex flex-wrap gap-x-3 text-xs text-gray-500">
							<span>{entry.result.recordedBy ?? 'Unknown user'}</span>
							<span>{formatDateTime(entry.result.recordedAt)}</span>
							{entry.result.attachments.length > 0 && (
								<span>
									{entry.result.attachments.length} evidence file
									{entry.result.attachments.length === 1 ? '' : 's'}
								</span>
							)}
						</div>
						{entry.result.notes && (
							<p className="truncate text-xs text-gray-700">
								{entry.result.notes}
							</p>
						)}
					</li>
				))}
			</ul>
			{limit && entries.length > limit && (
				<Link
					to={`${Route.viewTestCase(projectShortCode, testCaseNumber)}#history`}
					className="text-xs font-medium text-brand-600 hover:underline"
				>
					See all {entries.length} results
				</Link>
			)}
		</div>
	)
}
