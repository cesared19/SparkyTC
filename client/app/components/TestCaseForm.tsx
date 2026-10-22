import { Form, useSubmit } from '@remix-run/react'
import {
	PropertyConfiguration,
	PropertyType,
	TestCase,
	CreateTestCase,
	TestCaseSection,
} from '../models/types'
import { useState } from 'react'
import { useRef, useEffect } from 'react'
import { SelectDropdown } from './SelectDropdown'
import { ErrorMessage } from './ErrorMessage'
import { PropertyInput } from './PropertyInput'
import { SectionSelect } from './SectionSelect'
import { LabelInput } from './LabelInput'

export enum TestCaseFormMode {
	create,
	edit,
}

interface TestCaseFormProps {
	properties: PropertyConfiguration[]
	sections: TestCaseSection[]
	// where a new test case is filed, e.g. the section open in the list
	defaultSectionID?: string
	// the labels already used in the project
	labelSuggestions?: string[]
	defaultValues?: TestCase
	mode: TestCaseFormMode
	onCancel: () => void
	onSubmit: (testCase: CreateTestCase) => void
	error?: string
	onDelete?: () => void
}

export function TestCaseForm({
	properties,
	sections,
	defaultSectionID,
	labelSuggestions = [],
	defaultValues = undefined,
	mode,
	onCancel,
	onSubmit,
	error,
	onDelete,
}: TestCaseFormProps) {
	const [propertyValues, setPropertyValues] = useState<Record<string, string>>(
		() => {
			if (mode === TestCaseFormMode.create) {
				// Create mode - use default values from properties
				return properties.reduce((acc, property) => {
					if (property.defaultValue) {
						acc[property.propertyConfigurationID] = property.defaultValue
					}
					return acc
				}, {} as Record<string, string>)
			} else if (mode === TestCaseFormMode.edit) {
				// Edit mode - use existing values
				return defaultValues?.propertyValues || {}
			}
			return {}
		}
	)

	const [sectionID, setSectionID] = useState(
		defaultValues?.sectionID ??
			defaultSectionID ??
			sections.find((section) => !section.parentID)?.sectionID ??
			''
	)

	const [labels, setLabels] = useState<string[]>(defaultValues?.labels ?? [])

	const handlePropertyChange = (propertyID: string, value?: string) => {
		setPropertyValues((prev) => {
			if (value) {
				return {
					...prev,
					[propertyID]: value,
				}
			} else {
				const newValues = { ...prev }
				delete newValues[propertyID]
				return newValues
			}
		})
	}

	const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault()
		const formData = new FormData(event.currentTarget)

		const testCase: CreateTestCase = {
			title: formData.get('title') as string,
			description: formData.get('description') as string,
			testInstructions: formData.get('testInstructions') as string,
			propertyValues,
			...(sectionID ? { sectionID } : {}),
			labels,
		}

		onSubmit(testCase)
	}

	return (
		<Form method="post" className="space-y-6" onSubmit={handleSubmit}>
			{error && <ErrorMessage message={error} />}

			{/* Title Field */}
			<div>
				<label
					htmlFor="title"
					className="block text-base font-semibold text-gray-700"
				>
					Title
				</label>
				<input
					type="text"
					name="title"
					id="title"
					defaultValue={defaultValues?.title}
					className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
					placeholder="Enter test case title"
				/>
			</div>

			<div>
				<label
					htmlFor="sectionID"
					className="block text-base font-semibold text-gray-700"
				>
					Section
				</label>
				<SectionSelect
					id="sectionID"
					sections={sections}
					value={sectionID}
					onChange={setSectionID}
					className="mt-1 w-full sm:w-auto"
				/>
			</div>

			<div>
				<label
					htmlFor="labels"
					className="block text-base font-semibold text-gray-700"
				>
					Labels
				</label>
				<LabelInput
					id="labels"
					labels={labels}
					suggestions={labelSuggestions}
					onChange={setLabels}
				/>
				<p className="mt-1 text-xs text-gray-500">
					Free labels to find test cases across suites, e.g. smoke or payments.
					Press Enter or type a comma to add one.
				</p>
			</div>

			{/* Description Field */}
			<div>
				<label
					htmlFor="description"
					className="block text-base font-semibold text-gray-700"
				>
					Description
				</label>
				<textarea
					name="description"
					id="description"
					rows={3}
					defaultValue={defaultValues?.description}
					className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
					placeholder="Enter test case description"
				/>
			</div>

			{/* Properties Section */}
			<div>
				<h3 className="block text-md font-semibold text-gray-700 mb-3">
					Properties
				</h3>
				<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
					{properties.map((property) => (
						<div key={property.propertyConfigurationID}>
							<div className="text-sm font-medium text-gray-900">
								{property.title}
							</div>
							<PropertyInput
								property={property}
								initialValue={propertyValues[property.propertyConfigurationID]}
								onChange={(value) =>
									handlePropertyChange(property.propertyConfigurationID, value)
								}
								onUnset={() =>
									handlePropertyChange(
										property.propertyConfigurationID,
										undefined
									)
								}
							/>
						</div>
					))}
				</div>
			</div>

			{/* Test Instructions Section */}
			<div>
				<label
					htmlFor="testInstructions"
					className="block text-base font-semibold text-gray-700"
				>
					Test Instructions
				</label>
				<div className="space-y-2">
					<textarea
						name="testInstructions"
						id="testInstructions"
						rows={5}
						defaultValue={defaultValues?.testInstructions}
						className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
						placeholder="1. Navigate to login page&#10;2. Enter credentials&#10;3. Click login button&#10;4. Verify dashboard is displayed"
					/>
					<p className="text-xs text-gray-500">
						Enter the instructions for the test
					</p>
				</div>
			</div>

			<div className="flex justify-end space-x-3">
				{mode === TestCaseFormMode.edit && onDelete && (
					<button
						type="button"
						onClick={onDelete}
						className="rounded-md border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
					>
						Delete
					</button>
				)}
				<button
					type="button"
					onClick={onCancel}
					className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
				>
					Cancel
				</button>
				<button
					type="submit"
					className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
				>
					{mode === TestCaseFormMode.create ? 'Create' : 'Update'}
				</button>
			</div>
		</Form>
	)
}
