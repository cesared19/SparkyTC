import { useFetcher } from '@remix-run/react'
import { useEffect, useRef, useState } from 'react'
import { DateDisplay } from '~/components/DateDisplay'
import { ErrorResponse, ProjectApiToken } from '~/models/types'
import { Route } from '~/utility/Routes'

type CreateTokenRequest = {
	intent: 'create'
	projectShortCode: string
	name: string
	canWrite: boolean
}

type TokenRequest = CreateTokenRequest | { intent: 'revoke'; tokenID: string }

type TokenResponse = ErrorResponse | { ok: true; secret?: string }

const PERMISSIONS = [
	{
		canWrite: false,
		label: 'Read',
		description: 'Reads suites, test cases, plans and results',
	},
	{
		canWrite: true,
		label: 'Read and write',
		description: 'Also creates sections, test cases and plans',
	},
]

function PermissionBadge({ canWrite }: { canWrite: boolean }) {
	return (
		<span
			className={`rounded-full px-2 py-0.5 text-xs font-medium ${
				canWrite ? 'bg-brand-50 text-brand-700' : 'bg-gray-100 text-gray-600'
			}`}
		>
			{canWrite ? 'Read and write' : 'Read'}
		</span>
	)
}

const buttonClassName =
	'rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40'

/** Copies text, also without HTTPS or clipboard permission, where the clipboard API isn't available. */
async function copyText(text: string) {
	if (navigator.clipboard && window.isSecureContext) {
		try {
			await navigator.clipboard.writeText(text)
			return
		} catch {
			// fall back below
		}
	}
	const area = document.createElement('textarea')
	area.value = text
	area.setAttribute('readonly', '')
	area.style.position = 'fixed'
	area.style.opacity = '0'
	document.body.append(area)
	area.select()
	document.execCommand('copy')
	area.remove()
}

/**
 * Tokens other apps, like co-bord, use to read this project (its suites, test cases, plans and their latest
 * results) through the integration API, and to create sections, test cases and plans when they can write.
 * The token is shown once, when it's created.
 */
export function ApiTokens({
	projectShortCode,
	tokens,
}: {
	projectShortCode: string
	tokens: ProjectApiToken[]
}) {
	const fetcher = useFetcher<TokenResponse>()
	const submit = (body: TokenRequest) =>
		fetcher.submit(body, {
			method: 'post',
			action: Route.apiTokens,
			encType: 'application/json',
		})
	const nameRef = useRef<HTMLInputElement>(null)
	const [secret, setSecret] = useState<string | null>(null)
	const [copied, setCopied] = useState(false)
	const [confirming, setConfirming] = useState<string | null>(null)
	const [canWrite, setCanWrite] = useState(false)
	const busy = fetcher.state !== 'idle'
	const error =
		fetcher.state === 'idle' && fetcher.data && 'message' in fetcher.data
			? fetcher.data.message
			: undefined

	useEffect(() => {
		if (
			fetcher.state === 'idle' &&
			fetcher.data &&
			'secret' in fetcher.data &&
			fetcher.data.secret
		) {
			setSecret(fetcher.data.secret)
			setCopied(false)
			setCanWrite(false)
			if (nameRef.current) nameRef.current.value = ''
		}
	}, [fetcher.state, fetcher.data])

	return (
		<div className="space-y-4">
			{secret && (
				<div className="space-y-2 rounded-md border border-green-200 bg-green-50 p-3">
					<p className="text-sm font-medium text-green-800">
						Copy the token now. It won&apos;t be shown again.
					</p>
					<div className="flex flex-wrap items-center gap-2">
						<code className="min-w-0 flex-1 break-all rounded bg-white px-2 py-1 font-mono text-xs text-gray-900">
							{secret}
						</code>
						<button
							type="button"
							className={buttonClassName}
							onClick={async () => {
								await copyText(secret)
								setCopied(true)
							}}
						>
							{copied ? 'Copied' : 'Copy'}
						</button>
						<button
							type="button"
							className={buttonClassName}
							onClick={() => setSecret(null)}
						>
							Done
						</button>
					</div>
				</div>
			)}

			<form
				onSubmit={(event) => {
					event.preventDefault()
					const name = nameRef.current?.value.trim()
					if (name)
						submit({ intent: 'create', projectShortCode, name, canWrite })
				}}
			>
				<label
					htmlFor="new-api-token"
					className="block text-xs font-medium text-gray-700"
				>
					New token
				</label>
				<div className="mt-1 flex gap-2">
					<input
						ref={nameRef}
						id="new-api-token"
						placeholder="Name, e.g. co-bord"
						maxLength={100}
						required
						className="block w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
					/>
					<button
						type="submit"
						disabled={busy}
						className="shrink-0 rounded-md bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-50"
					>
						{busy ? 'Creating...' : 'Create token'}
					</button>
				</div>
				<fieldset className="mt-2">
					<legend className="text-xs font-medium text-gray-700">
						Permission
					</legend>
					<div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
						{PERMISSIONS.map((permission) => (
							<label
								key={permission.label}
								className="flex items-start gap-2 text-sm text-gray-700"
							>
								<input
									type="radio"
									name="api-token-permission"
									checked={canWrite === permission.canWrite}
									onChange={() => setCanWrite(permission.canWrite)}
									className="mt-0.5 h-4 w-4 border-gray-300 text-brand-600 focus:ring-brand-500"
								/>
								<span>
									{permission.label}
									<span className="block text-xs text-gray-500">
										{permission.description}
									</span>
								</span>
							</label>
						))}
					</div>
				</fieldset>
				{error && <p className="mt-1 text-xs text-red-600">{error}</p>}
			</form>

			{tokens.length === 0 ? (
				<p className="text-sm text-gray-500">No tokens yet.</p>
			) : (
				<ul className="divide-y divide-gray-200 rounded-md border border-gray-200">
					{tokens.map((token) => (
						<li
							key={token.tokenID}
							className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2 text-sm"
						>
							<span className="min-w-0 flex-1">
								<span className="flex flex-wrap items-center gap-2 font-medium text-gray-900">
									{token.name}
									<PermissionBadge canWrite={token.canWrite} />
								</span>
								<span className="block text-xs text-gray-500">
									<code className="font-mono">{token.tokenPrefix}…</code> ·
									Created <DateDisplay date={token.creationDate} />
									{token.createdBy ? ` by ${token.createdBy}` : ''} ·{' '}
									{token.lastUsedAt ? (
										<>
											Last used <DateDisplay date={token.lastUsedAt} />
										</>
									) : (
										'Never used'
									)}
								</span>
							</span>
							{confirming === token.tokenID ? (
								<span className="flex items-center gap-2">
									<span className="text-xs text-gray-600">
										Apps using it stop working.
									</span>
									<button
										type="button"
										disabled={busy}
										className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
										onClick={() => {
											submit({ intent: 'revoke', tokenID: token.tokenID })
											setConfirming(null)
										}}
									>
										Revoke
									</button>
									<button
										type="button"
										className={buttonClassName}
										onClick={() => setConfirming(null)}
									>
										Cancel
									</button>
								</span>
							) : (
								<button
									type="button"
									className={buttonClassName}
									onClick={() => setConfirming(token.tokenID)}
								>
									Revoke
								</button>
							)}
						</li>
					))}
				</ul>
			)}
		</div>
	)
}
