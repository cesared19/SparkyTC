import { useEffect, useRef, useState } from 'react'
import { ExportFormat } from '~/utility/TestCaseExport'

/** A button that offers the CSV and Excel formats of an export. */
export function ExportMenu({
	label = 'Export',
	onExport,
}: {
	label?: string
	onExport: (format: ExportFormat) => Promise<void> | void
}) {
	const [isOpen, setIsOpen] = useState(false)
	const [isExporting, setIsExporting] = useState(false)
	const ref = useRef<HTMLDivElement>(null)

	// a click elsewhere closes the menu
	useEffect(() => {
		if (!isOpen) return
		const close = (event: MouseEvent) => {
			if (!ref.current?.contains(event.target as Node)) setIsOpen(false)
		}
		document.addEventListener('mousedown', close)
		return () => document.removeEventListener('mousedown', close)
	}, [isOpen])

	const run = async (format: ExportFormat) => {
		setIsOpen(false)
		setIsExporting(true)
		try {
			await onExport(format)
		} finally {
			setIsExporting(false)
		}
	}

	return (
		<div ref={ref} className="relative">
			<button
				type="button"
				aria-haspopup="menu"
				aria-expanded={isOpen}
				disabled={isExporting}
				onClick={() => setIsOpen(!isOpen)}
				className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
			>
				{isExporting ? 'Exporting...' : label}
				<svg
					className="h-4 w-4"
					viewBox="0 0 20 20"
					fill="currentColor"
					aria-hidden="true"
				>
					<path d="M5.5 8l4.5 4.5L14.5 8z" />
				</svg>
			</button>
			{isOpen && (
				<div
					role="menu"
					className="absolute left-0 z-20 mt-1 w-44 rounded-md border border-gray-200 bg-white py-1 shadow-lg"
				>
					{[
						{ format: 'xlsx' as const, label: 'Excel (.xlsx)' },
						{ format: 'csv' as const, label: 'CSV (.csv)' },
					].map((option) => (
						<button
							key={option.format}
							type="button"
							role="menuitem"
							onClick={() => run(option.format)}
							className="block w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
						>
							{option.label}
						</button>
					))}
				</div>
			)}
		</div>
	)
}
