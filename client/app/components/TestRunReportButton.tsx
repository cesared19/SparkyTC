import { useState } from 'react'
import {
	downloadTestRunReport,
	TestRunReportInput,
} from '~/utility/TestRunReport'

/** Downloads the test run report: a summary image and a PDF of the executed test cases, in a .zip. */
export function TestRunReportButton(props: TestRunReportInput) {
	const [isPreparing, setIsPreparing] = useState(false)
	const [error, setError] = useState<string>()

	const download = async () => {
		setIsPreparing(true)
		setError(undefined)
		try {
			await downloadTestRunReport(props)
		} catch (reason) {
			console.error(reason)
			setError("The report couldn't be generated, try again.")
		} finally {
			setIsPreparing(false)
		}
	}

	return (
		<div className="flex flex-col items-end gap-1">
			<button
				type="button"
				onClick={download}
				disabled={isPreparing}
				className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-wait disabled:opacity-60"
			>
				<svg
					className="h-4 w-4"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					strokeWidth={1.5}
					aria-hidden="true"
				>
					<path
						strokeLinecap="round"
						strokeLinejoin="round"
						d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3"
					/>
				</svg>
				{isPreparing ? 'Preparing report...' : 'Download report'}
			</button>
			{error && <p className="text-xs text-red-600">{error}</p>}
		</div>
	)
}
