import { TestCaseRunStatus } from '~/models/types'

const OPTIONS: {
	status: TestCaseRunStatus
	label: string
	active: string
	idle: string
}[] = [
	{
		status: TestCaseRunStatus.pass,
		label: 'Pass',
		active: 'bg-green-100 text-green-800 ring-1 ring-green-600',
		idle: 'hover:bg-green-50 hover:text-green-700',
	},
	{
		status: TestCaseRunStatus.fail,
		label: 'Fail',
		active: 'bg-red-100 text-red-800 ring-1 ring-red-600',
		idle: 'hover:bg-red-50 hover:text-red-700',
	},
	{
		status: TestCaseRunStatus.blocked,
		label: 'Blocked',
		active: 'bg-violet-100 text-violet-800 ring-1 ring-violet-600',
		idle: 'hover:bg-violet-50 hover:text-violet-700',
	},
	{
		status: TestCaseRunStatus.skip,
		label: 'Skip',
		active: 'bg-cyan-100 text-cyan-800 ring-1 ring-cyan-600',
		idle: 'hover:bg-cyan-50 hover:text-cyan-700',
	},
]

/** The result of a test case: Pass, Fail, Blocked or Skip. */
export function ResultChooser({
	value,
	onChange,
	disabled = false,
	label,
}: {
	value: TestCaseRunStatus
	onChange: (status: TestCaseRunStatus) => void
	disabled?: boolean
	// for screen readers, when there's more than one on the page
	label: string
}) {
	return (
		<fieldset
			disabled={disabled}
			className="flex flex-wrap gap-3 disabled:opacity-50"
		>
			<legend className="sr-only">{label}</legend>
			{OPTIONS.map((option) => (
				<button
					key={option.status}
					type="button"
					aria-pressed={value === option.status}
					onClick={() => onChange(option.status)}
					className={`rounded-md px-4 py-2 text-sm font-medium ${
						value === option.status
							? option.active
							: `bg-gray-50 text-gray-700 ${option.idle}`
					}`}
				>
					{option.label}
				</button>
			))}
		</fieldset>
	)
}
