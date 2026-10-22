import { useState } from 'react'
import {
	PropertyType,
	type PropertyConfiguration,
	type TestCase,
	type TestCaseSection,
} from '~/models/types'

import { SelectDropdown } from './SelectDropdown'
import { Table, type Column } from './Table'
import { Tools } from '~/utility/Tools'
import { Project } from '~/models/project'
import { Checkbox } from './Checkbox'
import { SectionSelect } from './SectionSelect'
import {
	hasAllLabels,
	LabelChip,
	LabelFilter,
	projectLabels,
} from './LabelInput'
import {
	flattenTree,
	sectionAndDescendants,
	sectionPath,
	sectionTree,
} from '~/utility/Sections'

// Example: you might define a union for your filter values.
// "text" covers both text/number; "select" covers multi-select checkboxes.
type FilterValue =
	| { type: 'text'; value: string }
	| { type: 'select'; values: string[] }

interface TestCaseSelectorProps {
	properties: PropertyConfiguration[]
	testCases: TestCase[]
	sections: TestCaseSection[]
	onDone: (selectedTestCases: TestCase[]) => void
	initialSelectedTestCases?: TestCase[]
	project: Project
}

export default function TestCaseSelector({
	properties,
	testCases,
	sections,
	onDone,
	initialSelectedTestCases = [],
	project,
}: TestCaseSelectorProps) {
	const [searchQuery, setSearchQuery] = useState('')
	// a suite or section, with the sections nested in it
	const [sectionFilter, setSectionFilter] = useState('')
	const [labelFilter, setLabelFilter] = useState<string[]>([])
	const sectionIDs = sectionFilter
		? sectionAndDescendants(sections, sectionFilter)
		: undefined
	// listed in the order of the tree, like the test case list
	const sectionOrder = new Map(
		flattenTree(sectionTree(sections)).map((node, index) => [
			node.section.sectionID,
			index,
		])
	)
	const sectionIndex = (testCase: TestCase) =>
		sectionOrder.get(testCase.sectionID ?? '') ?? Infinity
	const [showFilters, setShowFilters] = useState(false)

	// Instead of storing a single string per property,
	// store a FilterValue for maximum flexibility.
	const [selectedFilters, setSelectedFilters] = useState<
		Record<string, FilterValue>
	>({})

	// We still track which properties we have “added” as filters
	const [selectedPropertyIDs, setSelectedPropertyIDs] = useState<string[]>([])

	// Convert to Set of IDs
	const [selectedTestCaseIDs, setSelectedTestCaseIDs] = useState<Set<string>>(
		new Set(initialSelectedTestCases.map((tc) => tc.testCaseID))
	)

	// 1) Filter logic
	const matchingTestCases = testCases.filter((testCase: TestCase) => {
		// For each property in selectedFilters, check if the test case matches
		const matchesAllFilters = Object.entries(selectedFilters).every(
			([propertyID, filterValue]) => {
				const testCaseVal = testCase.propertyValues[propertyID] ?? ''

				if (filterValue.type === 'text') {
					// Only filter if there's a text value
					return (
						filterValue.value === '' ||
						testCaseVal
							.toString()
							.toLowerCase()
							.includes(filterValue.value.toLowerCase())
					)
				} else if (filterValue.type === 'select') {
					// Only filter if there are selected values
					return (
						filterValue.values.length === 0 ||
						filterValue.values.includes(testCaseVal)
					)
				}
				return true
			}
		)

		// Also match the overall search on title/description
		const matchesSearch = searchQuery
			? testCase.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
			  (testCase.description?.toLowerCase() || '').includes(
					searchQuery.toLowerCase()
			  )
			: true

		const matchesSection =
			!sectionIDs ||
			(!!testCase.sectionID && sectionIDs.has(testCase.sectionID))

		return (
			matchesAllFilters &&
			matchesSearch &&
			matchesSection &&
			hasAllLabels(testCase, labelFilter)
		)
	})
	const filteredTestCases = [...matchingTestCases].sort(
		(a, b) =>
			sectionIndex(a) - sectionIndex(b) || a.testCaseNumber - b.testCaseNumber
	)

	// 2) Handlers

	// When user selects a property from the dropdown
	const handleAddProperty = (propertyID: string) => {
		setSelectedPropertyIDs((prev) => [...prev, propertyID])
		// If it has selectOptions, assume type=select and empty array
		// Otherwise assume type=text with empty string
		const property = properties.find(
			(p) => p.propertyConfigurationID === propertyID
		)
		let initialFilterValue: FilterValue

		if (property?.selectOptions && property.selectOptions.length > 0) {
			initialFilterValue = { type: 'select', values: [] }
		} else {
			initialFilterValue = { type: 'text', value: '' }
		}

		setSelectedFilters((prev) => ({
			...prev,
			[propertyID]: initialFilterValue,
		}))
		setShowFilters(false)
	}

	const handleRemoveProperty = (propertyID: string) => {
		setSelectedPropertyIDs((prev) => prev.filter((id) => id !== propertyID))
		setSelectedFilters((prev) => {
			const { [propertyID]: _removed, ...rest } = prev
			return rest
		})
	}

	// For text/number property updates
	const handleTextChange = (propertyID: string, val: string) => {
		setSelectedFilters((prev) => ({
			...prev,
			[propertyID]: { type: 'text', value: val },
		}))
	}

	// For select property updates (checkbox lists)
	// Toggles a value on/off
	const handleSelectOptionToggle = (propertyID: string, option: string) => {
		setSelectedFilters((prev) => {
			const currentFilter = prev[propertyID] as {
				type: 'select'
				values: string[]
			}
			const { values } = currentFilter
			const newValues = values.includes(option)
				? values.filter((v) => v !== option)
				: [...values, option]

			return {
				...prev,
				[propertyID]: { type: 'select', values: newValues },
			}
		})
	}

	const handleToggleTestCase = (testCase: TestCase) => {
		setSelectedTestCaseIDs((prev) => {
			const next = new Set(prev)
			if (next.has(testCase.testCaseID)) {
				next.delete(testCase.testCaseID)
			} else {
				next.add(testCase.testCaseID)
			}
			return next
		})
	}

	const availableProperties = properties.filter(
		(prop) => !selectedPropertyIDs.includes(prop.propertyConfigurationID)
	)

	const renderFilterInput = (
		property: PropertyConfiguration,
		propertyID: string,
		filterValue: FilterValue
	) => {
		switch (property.propertyType) {
			case PropertyType.singleSelectList:
				return (
					<div className="flex flex-col gap-1 mt-1">
						{property.selectOptions?.map((option) => {
							const selected =
								filterValue.type === 'select' &&
								filterValue.values.includes(option)
							return (
								<label key={option} className="inline-flex items-center">
									<input
										type="checkbox"
										className="h-4 w-4"
										checked={selected}
										onChange={() =>
											handleSelectOptionToggle(propertyID, option)
										}
									/>
									<span className="ml-2 text-sm text-gray-700">{option}</span>
								</label>
							)
						})}
					</div>
				)

			case PropertyType.text:
			case PropertyType.number:
				return (
					<input
						type="text"
						className="block w-full rounded-md bg-gray-50 px-3 py-2 text-gray-900 placeholder-gray-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
						placeholder="Type filter..."
						value={filterValue.type === 'text' ? filterValue.value : ''}
						onChange={(e) => handleTextChange(propertyID, e.target.value)}
					/>
				)
			default:
				return <p>Unsupported property type</p>
		}
	}

	const getTableColumns = (): Column<TestCase>[] => {
		return [
			{
				header: '',
				key: 'selection',
				render: (testCase) => {
					const isSelected = selectedTestCaseIDs.has(testCase.testCaseID)
					return <Checkbox isSelected={isSelected} />
				},
			},
			{
				header: 'ID',
				key: 'id',
				mobile: 'subtitle',
				render: (testCase) => Tools.testCaseDisplayCode(project, testCase),
			},
			{
				header: 'Title',
				key: 'title',
				mobile: 'title',
				render: (testCase) => (
					<div>
						<div className="font-medium text-gray-900">{testCase.title}</div>
						<div className="text-xs text-gray-500">
							{sectionPath(sections, testCase.sectionID)}
						</div>
						{(testCase.labels?.length ?? 0) > 0 && (
							<div className="mt-1 flex flex-wrap gap-1">
								{testCase.labels?.map((label) => (
									<LabelChip key={label} label={label} />
								))}
							</div>
						)}
						{testCase.description && (
							<div className="text-sm text-gray-500">
								{testCase.description}
							</div>
						)}
					</div>
				),
			},
		]
	}

	return (
		<div className="space-y-6">
			{/* Selected Test Cases count */}
			<div>
				<h2 className="text-lg font-medium text-gray-900 mb-4">
					Selected Test Cases: {selectedTestCaseIDs.size}
				</h2>
			</div>

			{/* Basic text search (title/desc) + Filter button */}
			<div className="flex flex-wrap items-center gap-4">
				<SectionSelect
					sections={sections}
					value={sectionFilter}
					onChange={setSectionFilter}
					emptyLabel="All suites and sections"
					className="py-2"
				/>
				<input
					type="text"
					placeholder="Search test cases..."
					value={searchQuery}
					onChange={(e) => setSearchQuery(e.target.value)}
					className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
				/>

				<SelectDropdown
					value="Filter"
					options={availableProperties.map((prop) => prop.title)}
					onChange={(title) => {
						const property = availableProperties.find((p) => p.title === title)
						if (property) {
							handleAddProperty(property.propertyConfigurationID)
						}
					}}
					placeholder={
						availableProperties.length === 0 ? 'No more properties' : ''
					}
				/>
			</div>

			<LabelFilter
				labels={projectLabels(testCases)}
				selected={labelFilter}
				onChange={setLabelFilter}
			/>

			{/* Display existing filters */}
			<div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
				{selectedPropertyIDs.map((propertyID) => {
					const property = properties.find(
						(p) => p.propertyConfigurationID === propertyID
					)!
					const filterValue = selectedFilters[propertyID]

					return (
						<div
							key={propertyID}
							className="border border-gray-200 p-4 rounded-lg relative"
						>
							<div className="flex items-center justify-between mb-2">
								<label className="block text-sm font-medium text-gray-700">
									{property.title}
								</label>
								<button
									type="button"
									onClick={() => handleRemoveProperty(propertyID)}
									className="text-gray-400 hover:text-gray-500"
								>
									<span className="sr-only">Remove filter</span>
									<svg
										className="h-5 w-5"
										viewBox="0 0 20 20"
										fill="currentColor"
									>
										<path
											fillRule="evenodd"
											d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
											clipRule="evenodd"
										/>
									</svg>
								</button>
							</div>
							{renderFilterInput(property, propertyID, filterValue)}
						</div>
					)
				})}
			</div>

			{/* Filtered test cases */}
			<div className="mb-6">
				<h2 className="text-lg font-medium text-gray-900 mb-4">
					Available Test Cases ({filteredTestCases.length})
				</h2>
				<Table
					tableRows={filteredTestCases.map((testCase) => ({
						id: testCase.testCaseID,
						data: testCase,
						isSelected: selectedTestCaseIDs.has(testCase.testCaseID),
					}))}
					columns={getTableColumns()}
					onRowClick={handleToggleTestCase}
					allowSelectAll={true}
				/>
			</div>

			{/* Done button */}
			<div className="flex justify-end">
				<button
					onClick={() =>
						onDone(
							testCases.filter((tc) => selectedTestCaseIDs.has(tc.testCaseID))
						)
					}
					className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2"
				>
					Done
				</button>
			</div>
		</div>
	)
}
