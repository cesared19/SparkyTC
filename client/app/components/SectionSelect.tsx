import { TestCaseSection } from '~/models/types'
import { flattenTree, sectionTree } from '~/utility/Sections'

/** Dropdown of the project's suites and sections, indented by depth. */
export function SectionSelect({
	sections,
	value,
	onChange,
	id,
	name,
	emptyLabel,
	excludeIDs,
	className = '',
}: {
	sections: TestCaseSection[]
	value: string
	onChange: (sectionID: string) => void
	id?: string
	name?: string
	// an extra first option with an empty value, e.g. "All sections"
	emptyLabel?: string
	// sections that can't be chosen, e.g. a section can't move inside itself
	excludeIDs?: Set<string>
	className?: string
}) {
	const nodes = flattenTree(sectionTree(sections))
	return (
		<select
			id={id}
			name={name}
			value={value}
			onChange={(event) => onChange(event.target.value)}
			className={`rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 ${className}`}
		>
			{emptyLabel !== undefined && <option value="">{emptyLabel}</option>}
			{nodes.map(({ section, depth }) => (
				<option
					key={section.sectionID}
					value={section.sectionID}
					disabled={excludeIDs?.has(section.sectionID)}
				>
					{`${'   '.repeat(depth)}${section.name}`}
				</option>
			))}
		</select>
	)
}
