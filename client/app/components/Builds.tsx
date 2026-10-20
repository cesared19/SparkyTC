import { Link, useFetcher } from '@remix-run/react'
import { useEffect, useRef, useState } from 'react'
import { isTestRunClosed } from '~/components/Assignments'
import { DateDisplay } from '~/components/DateDisplay'
import { formatDuration } from '~/components/TimeTracking'
import { ErrorResponse, ProjectBuild, TestRun } from '~/models/types'
import { useIsAdmin } from '~/utility/CurrentUser'
import { Route } from '~/utility/Routes'

const inputClassName =
	'block w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500'

const buttonClassName =
	'rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40'

function useBuildFetcher() {
	const fetcher = useFetcher<ErrorResponse | { ok: true }>()
	const submit = (body: Record<string, string | null>) =>
		fetcher.submit(body, {
			method: 'post',
			action: Route.builds,
			encType: 'application/json',
		})
	const error =
		fetcher.state === 'idle' && fetcher.data && 'message' in fetcher.data
			? fetcher.data.message
			: undefined
	const saved = fetcher.state === 'idle' && fetcher.data !== undefined && !error
	return { fetcher, submit, error, saved }
}

/** Form admins use to register a new build, which becomes the project's current build. */
function NewBuildForm({ projectShortCode }: { projectShortCode: string }) {
	const { fetcher, submit, error, saved } = useBuildFetcher()
	const inputRef = useRef<HTMLInputElement>(null)

	useEffect(() => {
		if (saved && inputRef.current) inputRef.current.value = ''
	}, [saved])

	return (
		<form
			onSubmit={(event) => {
				event.preventDefault()
				const buildNumber = inputRef.current?.value.trim()
				if (buildNumber) {
					submit({ intent: 'create', projectShortCode, buildNumber })
				}
			}}
		>
			<label
				htmlFor={`new-build-${projectShortCode}`}
				className="block text-xs font-medium text-gray-700"
			>
				Register a new build
			</label>
			<div className="mt-1 flex gap-2">
				<input
					ref={inputRef}
					id={`new-build-${projectShortCode}`}
					placeholder="e.g. 2.3.1 (4512)"
					maxLength={100}
					required
					className={inputClassName}
				/>
				<button
					type="submit"
					disabled={fetcher.state !== 'idle'}
					className="shrink-0 rounded-md bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-50"
				>
					{fetcher.state !== 'idle' ? 'Saving...' : 'Register'}
				</button>
			</div>
			{error && <p className="mt-1 text-xs text-red-600">{error}</p>}
		</form>
	)
}

/** The project's newest build on the dashboard; admins register new ones from here. */
export function CurrentBuildCard({
	projectShortCode,
	build,
	timeSeconds,
}: {
	projectShortCode: string
	build?: ProjectBuild
	// time spent on the build's test runs that track time
	timeSeconds?: number
}) {
	const isAdmin = useIsAdmin()

	return (
		<div className="rounded-lg border border-gray-200 bg-white p-4">
			<div className="flex flex-wrap items-start justify-between gap-4">
				<div className="flex min-w-0 flex-wrap gap-x-10 gap-y-4">
					<div className="min-w-0">
						<div className="text-sm font-medium text-gray-500">
							Current build
						</div>
						{build ? (
							<>
								<div className="mt-1 break-all text-2xl font-semibold text-gray-900">
									{build.buildNumber}
								</div>
								<div className="mt-1 text-xs text-gray-500">
									Registered {build.createdBy ? `by ${build.createdBy} ` : ''}
									on <DateDisplay date={build.creationDate} />
								</div>
							</>
						) : (
							<p className="mt-1 text-sm text-gray-500">
								No builds registered yet.
								{!isAdmin && ' An admin registers the build being tested.'}
							</p>
						)}
					</div>
					{build && timeSeconds !== undefined && timeSeconds !== null && (
						<div>
							<div className="text-sm font-medium text-gray-500">
								Time spent testing
							</div>
							<div className="mt-1 text-2xl font-semibold tabular-nums text-gray-900">
								{formatDuration(timeSeconds)}
							</div>
							<div className="mt-1 text-xs text-gray-500">
								Test runs of this build that track time
							</div>
						</div>
					)}
				</div>
				{isAdmin && (
					<div className="w-full max-w-sm space-y-2">
						<NewBuildForm projectShortCode={projectShortCode} />
						<Link
							to={`${Route.projectSettings(projectShortCode)}#builds`}
							className="text-xs font-medium text-brand-600 hover:underline"
						>
							Manage builds
						</Link>
					</div>
				)}
			</div>
		</div>
	)
}

function BuildRow({
	build,
	isCurrent,
}: {
	build: ProjectBuild
	isCurrent: boolean
}) {
	const { fetcher, submit, error } = useBuildFetcher()
	const [buildNumber, setBuildNumber] = useState(build.buildNumber)
	const pendingIntent = (fetcher.json as { intent?: string } | undefined)
		?.intent

	useEffect(() => setBuildNumber(build.buildNumber), [build.buildNumber])

	if (fetcher.state !== 'idle' && pendingIntent === 'delete') return null

	const changed =
		buildNumber.trim() !== '' && buildNumber.trim() !== build.buildNumber

	return (
		<li className="py-3">
			<form
				className="flex flex-wrap items-center gap-2"
				onSubmit={(event) => {
					event.preventDefault()
					if (changed) {
						submit({
							intent: 'update',
							buildID: build.buildID,
							buildNumber: buildNumber.trim(),
						})
					}
				}}
			>
				<input
					value={buildNumber}
					onChange={(event) => setBuildNumber(event.target.value)}
					aria-label={`Build number for ${build.buildNumber}`}
					maxLength={100}
					className={`${inputClassName} max-w-xs`}
				/>
				<button
					type="submit"
					disabled={!changed || fetcher.state !== 'idle'}
					className={buttonClassName}
				>
					Save
				</button>
				<button
					type="button"
					disabled={fetcher.state !== 'idle'}
					onClick={() => {
						if (confirm(`Delete build ${build.buildNumber}?`)) {
							submit({ intent: 'delete', buildID: build.buildID })
						}
					}}
					className={`${buttonClassName} text-red-600`}
				>
					Delete
				</button>
				<span className="text-xs text-gray-500">
					{isCurrent && (
						<span className="mr-2 rounded-full bg-brand-50 px-2 py-0.5 font-medium text-brand-700">
							Current
						</span>
					)}
					{build.createdBy ? `${build.createdBy} · ` : ''}
					<DateDisplay date={build.creationDate} />
				</span>
			</form>
			{error && <p className="mt-1 text-xs text-red-600">{error}</p>}
		</li>
	)
}

/** Every build of the project, newest first, for admins to fix or remove. */
export function BuildManager({
	projectShortCode,
	builds,
}: {
	projectShortCode: string
	builds: ProjectBuild[]
}) {
	return (
		<div className="space-y-4">
			<NewBuildForm projectShortCode={projectShortCode} />
			{builds.length === 0 ? (
				<p className="text-sm text-gray-500">No builds registered yet.</p>
			) : (
				<ul className="divide-y divide-gray-200">
					{builds.map((build, index) => (
						<BuildRow
							key={build.buildID}
							build={build}
							isCurrent={index === 0}
						/>
					))}
				</ul>
			)}
			<p className="text-xs text-gray-500">
				The newest build is the current one. Builds used by a test run can be
				renamed but not deleted.
			</p>
		</div>
	)
}

/** Dropdown of the project's registered builds, newest first. */
export function BuildSelect({
	builds,
	value,
	onChange,
	id,
	name,
	disabled,
}: {
	builds: ProjectBuild[]
	value: string
	onChange: (buildID: string) => void
	id?: string
	name?: string
	disabled?: boolean
}) {
	return (
		<select
			id={id}
			name={name}
			value={value}
			disabled={disabled}
			onChange={(event) => onChange(event.target.value)}
			className="rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
		>
			<option value="">No build</option>
			{builds.map((build, index) => (
				<option key={build.buildID} value={build.buildID}>
					{build.buildNumber}
					{index === 0 ? ' (current)' : ''}
				</option>
			))}
		</select>
	)
}

/** The build a test run is testing; anyone working on it can change it while the run is open. */
export function TestRunBuild({
	testRun,
	builds,
}: {
	testRun: TestRun
	builds: ProjectBuild[]
}) {
	const { fetcher, submit, error } = useBuildFetcher()
	const pending = fetcher.json as { buildID?: string | null } | undefined
	const value =
		fetcher.state !== 'idle' && pending
			? pending.buildID ?? ''
			: testRun.build?.buildID ?? ''

	if (isTestRunClosed(testRun)) {
		return (
			<span className="text-sm text-gray-900">
				{testRun.build?.buildNumber ?? 'No build'}
			</span>
		)
	}

	return (
		<span className="inline-flex flex-wrap items-center gap-2">
			<BuildSelect
				builds={builds}
				value={value}
				disabled={fetcher.state !== 'idle'}
				onChange={(buildID) =>
					submit({
						intent: 'testRunBuild',
						testRunID: testRun.testRunID,
						buildID: buildID || null,
					})
				}
			/>
			{error && <span className="text-xs text-red-600">{error}</span>}
		</span>
	)
}
