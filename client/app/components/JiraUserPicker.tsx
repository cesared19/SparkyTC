import { useFetcher } from '@remix-run/react'
import { useEffect, useState } from 'react'
import { ErrorResponse, JiraUser, User } from '~/models/types'
import { Route } from '~/utility/Routes'

const SEARCH_DELAY_MS = 300

interface JiraUserPickerProps {
	user: User
	// set when an admin links another user, otherwise the signed in user links their own
	forOtherUser?: boolean
}

/**
 * Links the Jira user a SparkyTC user's issues are reported as, searched by name or email.
 * Issues of users without one are reported as the shared Jira account.
 */
export function JiraUserPicker({
	user,
	forOtherUser = false,
}: JiraUserPickerProps) {
	const searchFetcher = useFetcher<{ users: JiraUser[]; message?: string }>()
	const saveFetcher = useFetcher<ErrorResponse | { ok: true }>()
	const [query, setQuery] = useState('')
	const [isSearching, setIsSearching] = useState(!user.jiraAccountID)

	// search once typing pauses
	useEffect(() => {
		if (query.trim().length < 2) return
		const timeout = setTimeout(
			() => searchFetcher.load(Route.jiraUsers(query.trim())),
			SEARCH_DELAY_MS
		)
		return () => clearTimeout(timeout)
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [query])

	useEffect(() => {
		if (
			saveFetcher.state === 'idle' &&
			saveFetcher.data &&
			'ok' in saveFetcher.data
		) {
			setQuery('')
			setIsSearching(false)
		}
	}, [saveFetcher.state, saveFetcher.data])

	const save = (accountID: string | null) =>
		saveFetcher.submit(
			{ accountID, userID: forOtherUser ? user.userID : null },
			{
				method: 'post',
				action: Route.linkJiraUser,
				encType: 'application/json',
			}
		)

	const saveError =
		saveFetcher.data && 'message' in saveFetcher.data
			? saveFetcher.data.message
			: undefined
	const results = query.trim().length < 2 ? [] : searchFetcher.data?.users ?? []
	const searchError =
		query.trim().length < 2 ? undefined : searchFetcher.data?.message
	const isSaving = saveFetcher.state !== 'idle'

	return (
		<div className="space-y-2">
			{user.jiraAccountID ? (
				<div className="flex flex-wrap items-center gap-2 text-sm">
					<span className="text-gray-700">
						Reported as <b className="text-gray-900">{user.jiraDisplayName}</b>
					</span>
					<button
						type="button"
						onClick={() => setIsSearching(!isSearching)}
						className="text-xs font-medium text-brand-600 hover:text-brand-800"
					>
						Change
					</button>
					<button
						type="button"
						disabled={isSaving}
						onClick={() => save(null)}
						className="text-xs font-medium text-gray-600 hover:text-gray-900 disabled:opacity-50"
					>
						Unlink
					</button>
				</div>
			) : (
				<p className="text-sm text-gray-600">
					Not linked: issues are reported as the shared Jira account.
				</p>
			)}

			{isSearching && (
				<div className="space-y-2">
					<input
						type="search"
						value={query}
						onChange={(event) => setQuery(event.target.value)}
						placeholder="Search Jira by name or email"
						aria-label={`Search the Jira user of ${user.displayName}`}
						className="block w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
					/>
					{searchFetcher.state !== 'idle' && (
						<p className="text-xs text-gray-500">Searching...</p>
					)}
					{searchError && <p className="text-xs text-red-600">{searchError}</p>}
					{results.length > 0 && (
						<ul className="divide-y divide-gray-200 rounded-md border border-gray-200">
							{results.map((jiraUser) => (
								<li
									key={jiraUser.accountID}
									className="flex items-center gap-2 px-3 py-2"
								>
									{jiraUser.avatarURL && (
										<img
											src={jiraUser.avatarURL}
											alt=""
											className="h-6 w-6 shrink-0 rounded-full"
										/>
									)}
									<span className="min-w-0 flex-1">
										<span className="block truncate text-sm text-gray-900">
											{jiraUser.displayName}
										</span>
										{jiraUser.emailAddress && (
											<span className="block truncate text-xs text-gray-500">
												{jiraUser.emailAddress}
											</span>
										)}
									</span>
									<button
										type="button"
										disabled={isSaving}
										onClick={() => save(jiraUser.accountID)}
										className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
									>
										{jiraUser.accountID === user.jiraAccountID
											? 'Linked'
											: 'Link'}
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
			{saveError && <p className="text-xs text-red-600">{saveError}</p>}
		</div>
	)
}
