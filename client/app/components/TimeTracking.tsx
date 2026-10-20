import { useFetcher } from '@remix-run/react'
import { useEffect, useMemo, useState } from 'react'
import { isTestRunClosed } from '~/components/Assignments'
import {
	ErrorResponse,
	TestCaseRun,
	TestRun,
	TestRunTime,
} from '~/models/types'
import { useCurrentUser, useIsAdmin } from '~/utility/CurrentUser'
import { Route } from '~/utility/Routes'

/** e.g. 2h 05m, 45m or 30s */
export function formatDuration(seconds: number) {
	const total = Math.max(0, Math.round(seconds))
	if (total < 60) return `${total}s`
	const hours = Math.floor(total / 3600)
	const minutes = Math.floor((total % 3600) / 60)
	return hours > 0
		? `${hours}h ${String(minutes).padStart(2, '0')}m`
		: `${minutes}m`
}

/** The current time, updated every second while active. */
function useNow(isActive: boolean) {
	const [now, setNow] = useState(() => Date.now())
	useEffect(() => {
		if (!isActive) return
		setNow(Date.now())
		const interval = setInterval(() => setNow(Date.now()), 1000)
		return () => clearInterval(interval)
	}, [isActive])
	return now
}

function useTimerFetcher() {
	const fetcher = useFetcher<ErrorResponse | { ok: true }>()
	const submit = (body: Record<string, string | number | null>) =>
		fetcher.submit(body, {
			method: 'post',
			action: Route.timers,
			encType: 'application/json',
		})
	const error =
		fetcher.state === 'idle' && fetcher.data && 'message' in fetcher.data
			? fetcher.data.message
			: undefined
	return { fetcher, submit, error }
}

/**
 * The timer of a test case in a run that tracks time. It can be paused and resumed any number of
 * times, and recording the result stops it.
 */
export function TestCaseTimer({
	testRun,
	testCaseRun,
	isLocked,
}: {
	testRun: TestRun
	testCaseRun: TestCaseRun
	isLocked: boolean
}) {
	const currentUser = useCurrentUser()
	const { fetcher, submit, error } = useTimerFetcher()
	// when this data arrived, it's reloaded after starting or pausing
	// eslint-disable-next-line react-hooks/exhaustive-deps
	const loadedAt = useMemo(() => Date.now(), [testCaseRun])
	const isMineRunning = testCaseRun.runningTimers.some(
		(timer) => timer.userID === currentUser?.userID
	)
	const runningCount = testCaseRun.runningTimers.length
	const now = useNow(runningCount > 0)
	// the loaded time already counts running timers up to when the page loaded
	const seconds =
		testCaseRun.timeSeconds +
		(runningCount * Math.max(0, now - loadedAt)) / 1000
	const others = testCaseRun.runningTimers.filter(
		(timer) => timer.userID !== currentUser?.userID
	)
	const isClosed = isTestRunClosed(testRun)
	const isSubmitting = fetcher.state !== 'idle'

	return (
		<div>
			<div className="flex flex-wrap items-center gap-3">
				<span
					className="min-w-[5rem] text-2xl font-semibold tabular-nums text-gray-900"
					aria-live="off"
				>
					{formatDuration(seconds)}
				</span>
				{!isClosed && (
					<button
						type="button"
						disabled={isLocked || isSubmitting}
						onClick={() =>
							submit({
								intent: isMineRunning ? 'pause' : 'start',
								testCaseRunID: testCaseRun.testCaseRunID,
							})
						}
						className={`inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50 ${
							isMineRunning
								? 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
								: 'bg-brand-600 text-white hover:bg-brand-700'
						}`}
					>
						<svg
							className="h-4 w-4"
							viewBox="0 0 20 20"
							fill="currentColor"
							aria-hidden="true"
						>
							{isMineRunning ? (
								<path d="M6 4h3v12H6zM11 4h3v12h-3z" />
							) : (
								<path d="M6 4l10 6-10 6z" />
							)}
						</svg>
						{isMineRunning
							? 'Pause timer'
							: testCaseRun.timeSeconds > 0
							? 'Resume timer'
							: 'Start timer'}
					</button>
				)}
				{isMineRunning && (
					<span className="inline-flex items-center gap-1.5 text-xs text-gray-600">
						<span className="h-2 w-2 animate-pulse rounded-full bg-brand-600" />
						Timing
					</span>
				)}
				{others.length > 0 && (
					<span className="text-xs text-gray-500">
						Also timed by{' '}
						{others.map((timer) => timer.displayName ?? 'someone').join(', ')}
					</span>
				)}
				{error && <span className="text-xs text-red-600">{error}</span>}
			</div>
			{!isClosed && (
				<p className="mt-1 text-xs text-gray-500">
					Pause and resume as often as needed. Recording the result stops the
					timer.
				</p>
			)}
		</div>
	)
}

function localDay(date: number) {
	const day = new Date(date)
	return `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(
		2,
		'0'
	)}-${String(day.getDate()).padStart(2, '0')}`
}

/**
 * The time spent on a test run and how it split across days. Days are grouped in the browser's time
 * zone, so they're only computed after the page loads.
 */
export function TestRunTimeSection({
	testRun,
	time,
}: {
	testRun: TestRun
	time: TestRunTime
}) {
	const isAdmin = useIsAdmin()
	const [days, setDays] = useState<{ day: string; seconds: number }[]>()
	const [isEditing, setIsEditing] = useState(false)
	const { fetcher, submit, error } = useTimerFetcher()
	const isClosed = isTestRunClosed(testRun)
	const hasRunning = time.entries.some((entry) => !entry.endedAt)

	useEffect(() => {
		const totals = new Map<string, number>()
		for (const entry of time.entries) {
			const day = localDay(entry.startedAt)
			totals.set(day, (totals.get(day) ?? 0) + entry.seconds)
		}
		setDays(
			[...totals.entries()]
				.sort(([a], [b]) => a.localeCompare(b))
				.map(([day, seconds]) => ({ day, seconds }))
		)
	}, [time.entries])

	useEffect(() => {
		if (fetcher.state === 'idle' && fetcher.data && 'ok' in fetcher.data) {
			setIsEditing(false)
		}
	}, [fetcher.state, fetcher.data])

	const saveTotal = (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault()
		const form = new FormData(event.currentTarget)
		const hours = Number(form.get('hours') || 0)
		const minutes = Number(form.get('minutes') || 0)
		submit({
			intent: 'total',
			testRunID: testRun.testRunID,
			totalSeconds: Math.round(hours * 3600 + minutes * 60),
		})
	}

	const inputClassName =
		'w-20 rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500'

	return (
		<div className="space-y-3">
			<div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
				<span className="text-2xl font-semibold tabular-nums text-gray-900">
					{formatDuration(time.totalSeconds)}
				</span>
				{time.overrideSeconds !== undefined && time.overrideSeconds !== null ? (
					<span className="text-xs text-gray-500">
						Set by an admin · {formatDuration(time.trackedSeconds)} tracked
					</span>
				) : (
					hasRunning && (
						<span className="text-xs text-gray-500">
							Includes timers still running
						</span>
					)
				)}
				{isAdmin && isClosed && !isEditing && (
					<button
						type="button"
						onClick={() => setIsEditing(true)}
						className="text-xs font-medium text-brand-600 hover:text-brand-800"
					>
						Edit total
					</button>
				)}
				{isAdmin &&
					isClosed &&
					!isEditing &&
					time.overrideSeconds !== undefined &&
					time.overrideSeconds !== null && (
						<button
							type="button"
							disabled={fetcher.state !== 'idle'}
							onClick={() =>
								submit({
									intent: 'total',
									testRunID: testRun.testRunID,
									totalSeconds: null,
								})
							}
							className="text-xs font-medium text-gray-600 hover:text-gray-900"
						>
							Use tracked time
						</button>
					)}
			</div>

			{isEditing && (
				<form onSubmit={saveTotal} className="flex flex-wrap items-end gap-2">
					<label className="text-xs text-gray-600">
						Hours
						<input
							name="hours"
							type="number"
							min={0}
							defaultValue={Math.floor(time.totalSeconds / 3600)}
							className={`mt-1 block ${inputClassName}`}
						/>
					</label>
					<label className="text-xs text-gray-600">
						Minutes
						<input
							name="minutes"
							type="number"
							min={0}
							max={59}
							defaultValue={Math.floor((time.totalSeconds % 3600) / 60)}
							className={`mt-1 block ${inputClassName}`}
						/>
					</label>
					<button
						type="submit"
						disabled={fetcher.state !== 'idle'}
						className="rounded-md bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-50"
					>
						Save total
					</button>
					<button
						type="button"
						onClick={() => setIsEditing(false)}
						className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
					>
						Cancel
					</button>
				</form>
			)}
			{error && <p className="text-xs text-red-600">{error}</p>}

			{/* an admin's total replaces the tracked time, so its breakdown no longer adds up */}
			{(time.overrideSeconds === undefined || time.overrideSeconds === null) &&
				days &&
				days.length > 0 && (
					<div>
						<h4 className="text-xs font-medium text-gray-500">By day</h4>
						<ul className="mt-1 max-w-xs divide-y divide-gray-200 text-sm">
							{days.map(({ day, seconds }) => (
								<li key={day} className="flex justify-between py-1">
									<span className="text-gray-700">
										{new Date(`${day}T00:00:00`).toLocaleDateString('en-US', {
											weekday: 'short',
											month: 'short',
											day: 'numeric',
										})}
									</span>
									<span className="tabular-nums text-gray-900">
										{formatDuration(seconds)}
									</span>
								</li>
							))}
						</ul>
					</div>
				)}
			{time.entries.length === 0 &&
				(time.overrideSeconds === undefined ||
					time.overrideSeconds === null) && (
					<p className="text-sm text-gray-500">No time tracked yet.</p>
				)}
		</div>
	)
}
