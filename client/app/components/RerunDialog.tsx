import { useFetcher } from '@remix-run/react'
import { useEffect, useState } from 'react'
import { BuildSelect } from '~/components/Builds'
import { ErrorMessage } from '~/components/ErrorMessage'
import {
	ErrorResponse,
	ProjectBuild,
	TestCaseRun,
	TestCaseRunStatus,
	TestRun,
} from '~/models/types'

const OPTIONS = [
	{ status: TestCaseRunStatus.fail, label: 'Failed', checked: true },
	{ status: TestCaseRunStatus.blocked, label: 'Blocked', checked: true },
	{ status: TestCaseRunStatus.skip, label: 'Skipped', checked: false },
	{ status: TestCaseRunStatus.pending, label: 'Pending', checked: false },
]

/**
 * Creates a new test run with the test cases of this one that ended with the chosen results, for the build
 * that fixes them. The new run keeps the assignees and who took each test case.
 */
export function RerunDialog({
	testRun,
	testCaseRuns,
	builds,
	onClose,
}: {
	testRun: TestRun
	testCaseRuns: TestCaseRun[]
	builds: ProjectBuild[]
	onClose: () => void
}) {
	const fetcher = useFetcher<ErrorResponse>()
	const [statuses, setStatuses] = useState(
		OPTIONS.filter((option) => option.checked).map((option) => option.status)
	)
	// the newest build is the one being tested now
	const [buildID, setBuildID] = useState(builds[0]?.buildID ?? '')
	const [title, setTitle] = useState(`${testRun.title} (re-run)`)

	useEffect(() => {
		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === 'Escape') onClose()
		}
		document.addEventListener('keydown', handleKeyDown)
		return () => document.removeEventListener('keydown', handleKeyDown)
	}, [onClose])

	const count = (status: TestCaseRunStatus) =>
		testCaseRuns.filter(
			(run) => run.status === status && !run.testCase.isArchived
		).length
	const selectedCount = statuses.reduce((sum, status) => sum + count(status), 0)
	const isSubmitting = fetcher.state !== 'idle'

	const submit = (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault()
		fetcher.submit(
			{
				intent: 'rerun',
				testRunID: testRun.testRunID,
				rerun: { statuses, buildID: buildID || null, title },
			},
			{ method: 'post', encType: 'application/json' }
		)
	}

	return (
		<div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
			<button
				type="button"
				aria-label="Close"
				tabIndex={-1}
				onClick={onClose}
				className="absolute inset-0 cursor-default bg-black/50"
			/>
			<form
				role="dialog"
				aria-modal="true"
				aria-labelledby="rerun-title"
				onSubmit={submit}
				className="relative w-full max-w-md space-y-4 rounded-lg bg-white p-5 shadow-xl"
			>
				<div>
					<h2 id="rerun-title" className="text-lg font-semibold text-gray-900">
						Re-run test cases
					</h2>
					<p className="mt-1 text-sm text-gray-600">
						Creates a new test run with the test cases that ended with these
						results. It keeps the assignees and who took each test case.
					</p>
				</div>

				{fetcher.data?.message && (
					<ErrorMessage message={fetcher.data.message} />
				)}

				<fieldset>
					<legend className="text-sm font-medium text-gray-700">
						Test cases that ended as
					</legend>
					<div className="mt-2 grid grid-cols-2 gap-2">
						{OPTIONS.map((option) => (
							<label
								key={option.status}
								className="flex items-center gap-2 text-sm text-gray-700"
							>
								<input
									type="checkbox"
									checked={statuses.includes(option.status)}
									onChange={(event) =>
										setStatuses((current) =>
											event.target.checked
												? [...current, option.status]
												: current.filter((status) => status !== option.status)
										)
									}
									className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
								/>
								{option.label}
								<span className="text-xs text-gray-500">
									({count(option.status)})
								</span>
							</label>
						))}
					</div>
				</fieldset>

				<div>
					<label
						htmlFor="rerun-name"
						className="block text-sm font-medium text-gray-700"
					>
						Title
					</label>
					<input
						id="rerun-name"
						value={title}
						onChange={(event) => setTitle(event.target.value)}
						required
						className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
					/>
				</div>

				<div>
					<label
						htmlFor="rerun-build"
						className="block text-sm font-medium text-gray-700"
					>
						Build
					</label>
					<div className="mt-1">
						<BuildSelect
							id="rerun-build"
							builds={builds}
							value={buildID}
							onChange={setBuildID}
						/>
					</div>
				</div>

				<div className="flex flex-wrap items-center justify-end gap-3">
					<span className="mr-auto text-xs text-gray-500">
						{selectedCount} test case{selectedCount === 1 ? '' : 's'}
					</span>
					<button
						type="button"
						onClick={onClose}
						className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
					>
						Cancel
					</button>
					<button
						type="submit"
						disabled={selectedCount === 0 || isSubmitting}
						className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
					>
						{isSubmitting ? 'Creating...' : 'Create test run'}
					</button>
				</div>
			</form>
		</div>
	)
}
