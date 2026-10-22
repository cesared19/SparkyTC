import { useState } from 'react'

/** Labels of a test case as removable chips; Enter or a comma adds what was typed, suggesting existing ones. */
export function LabelInput({
	id,
	labels,
	suggestions,
	onChange,
}: {
	id?: string
	labels: string[]
	// the labels already used in the project
	suggestions: string[]
	onChange: (labels: string[]) => void
}) {
	const [text, setText] = useState('')
	const has = (label: string) =>
		labels.some((existing) => existing.toLowerCase() === label.toLowerCase())

	const add = (value: string) => {
		const label = value.trim().replace(/\s+/g, ' ')
		if (label && !has(label)) onChange([...labels, label])
		setText('')
	}

	return (
		<div className="mt-1 flex flex-wrap items-center gap-1.5 rounded-md border border-gray-300 px-2 py-1.5 focus-within:border-brand-500 focus-within:ring-1 focus-within:ring-brand-500">
			{labels.map((label) => (
				<LabelChip
					key={label}
					label={label}
					onRemove={() => onChange(labels.filter((other) => other !== label))}
				/>
			))}
			<input
				id={id}
				list={id ? `${id}-suggestions` : undefined}
				value={text}
				maxLength={50}
				placeholder={labels.length === 0 ? 'e.g. smoke, login' : ''}
				onChange={(event) => {
					const value = event.target.value
					// typing or pasting a comma adds the label before it
					if (value.includes(',')) {
						value.split(',').slice(0, -1).forEach(add)
						setText(value.split(',').pop() ?? '')
					} else {
						setText(value)
					}
				}}
				onKeyDown={(event) => {
					if (event.key === 'Enter') {
						event.preventDefault()
						add(text)
					} else if (event.key === 'Backspace' && !text && labels.length > 0) {
						onChange(labels.slice(0, -1))
					}
				}}
				onBlur={() => add(text)}
				className="min-w-[8rem] flex-1 border-0 bg-transparent p-0.5 text-sm focus:outline-none focus:ring-0"
			/>
			{id && (
				<datalist id={`${id}-suggestions`}>
					{suggestions
						.filter((suggestion) => !has(suggestion))
						.map((suggestion) => (
							<option key={suggestion} value={suggestion} />
						))}
				</datalist>
			)}
		</div>
	)
}

export function LabelChip({
	label,
	onRemove,
	selected = false,
	onClick,
}: {
	label: string
	onRemove?: () => void
	// for filters: a chip that toggles
	selected?: boolean
	onClick?: () => void
}) {
	const className = `inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
		selected ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-700'
	}`
	if (onClick) {
		return (
			<button
				type="button"
				aria-pressed={selected}
				onClick={onClick}
				className={`${className} hover:ring-1 hover:ring-brand-500`}
			>
				{label}
			</button>
		)
	}
	return (
		<span className={className}>
			{label}
			{onRemove && (
				<button
					type="button"
					aria-label={`Remove ${label}`}
					onClick={onRemove}
					className="text-gray-500 hover:text-gray-900"
				>
					×
				</button>
			)}
		</span>
	)
}

/** Every label used by the test cases, sorted, in its first spelling. */
export function projectLabels(testCases: { labels?: string[] }[]) {
	const labels = new Map<string, string>()
	for (const testCase of testCases) {
		for (const label of testCase.labels ?? []) {
			if (!labels.has(label.toLowerCase()))
				labels.set(label.toLowerCase(), label)
		}
	}
	return [...labels.values()].sort((a, b) =>
		a.localeCompare(b, undefined, { sensitivity: 'base' })
	)
}

/** Whether a test case has every one of the chosen labels. */
export function hasAllLabels(
	testCase: { labels?: string[] },
	chosen: string[]
) {
	const own = new Set(
		(testCase.labels ?? []).map((label) => label.toLowerCase())
	)
	return chosen.every((label) => own.has(label.toLowerCase()))
}

/** A row of toggleable label chips to filter test cases. */
export function LabelFilter({
	labels,
	selected,
	onChange,
}: {
	labels: string[]
	selected: string[]
	onChange: (selected: string[]) => void
}) {
	if (labels.length === 0) return null
	return (
		<div className="flex flex-wrap items-center gap-1.5">
			<span className="mr-1 text-xs font-medium text-gray-500">Labels</span>
			{labels.map((label) => {
				const isSelected = selected.includes(label)
				return (
					<LabelChip
						key={label}
						label={label}
						selected={isSelected}
						onClick={() =>
							onChange(
								isSelected
									? selected.filter((other) => other !== label)
									: [...selected, label]
							)
						}
					/>
				)
			})}
			{selected.length > 0 && (
				<button
					type="button"
					onClick={() => onChange([])}
					className="ml-1 text-xs text-gray-500 hover:text-gray-900"
				>
					Clear
				</button>
			)}
		</div>
	)
}
