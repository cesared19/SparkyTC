import { useState } from 'react'
import { ErrorMessage } from '~/components/ErrorMessage'
import { LabelFilter, projectLabels } from '~/components/LabelInput'
import { Project } from '~/models/project'
import {
	SaveTestPlan,
	TestCase,
	TestCaseSection,
	TestPlan,
} from '~/models/types'
import {
	flattenTree,
	groupBySection,
	sectionAndDescendants,
	sectionPath,
	sectionTree,
} from '~/utility/Sections'
import { planTestCases } from '~/utility/TestPlans'
import { Tools } from '~/utility/Tools'

const inputClassName =
	'mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500'

/** The name, description and rules of a test plan, with the test cases they choose right now. */
export function TestPlanForm({
	project,
	sections,
	testCases,
	defaultValues,
	onSubmit,
	onCancel,
	error,
	isSubmitting,
}: {
	project: Project
	sections: TestCaseSection[]
	testCases: TestCase[]
	defaultValues?: TestPlan
	onSubmit: (plan: SaveTestPlan) => void
	onCancel: () => void
	error?: string
	isSubmitting: boolean
}) {
	const [name, setName] = useState(defaultValues?.name ?? '')
	const [description, setDescription] = useState(
		defaultValues?.description ?? ''
	)
	const [sectionIDs, setSectionIDs] = useState<string[]>(
		defaultValues?.sectionIDs ?? []
	)
	const [labels, setLabels] = useState<string[]>(defaultValues?.labels ?? [])
	const [testCaseIDs, setTestCaseIDs] = useState<string[]>(
		defaultValues?.testCaseIDs ?? []
	)
	const [search, setSearch] = useState('')

	const rules = { sectionIDs, labels, testCaseIDs }
	const matches = planTestCases(rules, testCases, sections)
	const groups = groupBySection(
		sections,
		matches.map((match) => match.testCase)
	)
	// sections inside a chosen one are already included
	const includedSections = new Set(
		sectionIDs.flatMap((sectionID) => [
			...sectionAndDescendants(sections, sectionID),
		])
	)
	// labels the plan keeps even if no test case uses them anymore
	const labelOptions = projectLabels([...testCases, { labels }])
	const query = search.trim().toLowerCase()
	const matchesQuery = (testCase: TestCase) =>
		testCase.title.toLowerCase().includes(query) ||
		Tools.testCaseDisplayCode(project, testCase).toLowerCase().includes(query)
	// without a search, the chosen test cases
	const searchResults = testCases.filter((testCase) =>
		query ? matchesQuery(testCase) : testCaseIDs.includes(testCase.testCaseID)
	)

	const toggle = (list: string[], value: string) =>
		list.includes(value)
			? list.filter((item) => item !== value)
			: [...list, value]

	return (
		<form
			className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]"
			onSubmit={(event) => {
				event.preventDefault()
				onSubmit({
					name,
					description: description || undefined,
					sectionIDs,
					labels,
					testCaseIDs,
				})
			}}
		>
			<div className="space-y-6">
				{error && <ErrorMessage message={error} />}
				<div>
					<label
						htmlFor="planName"
						className="block text-base font-semibold text-gray-700"
					>
						Name
					</label>
					<input
						id="planName"
						value={name}
						onChange={(event) => setName(event.target.value)}
						required
						maxLength={200}
						placeholder="e.g. Regression"
						className={inputClassName}
					/>
				</div>
				<div>
					<label
						htmlFor="planDescription"
						className="block text-base font-semibold text-gray-700"
					>
						Description
					</label>
					<textarea
						id="planDescription"
						rows={2}
						value={description}
						onChange={(event) => setDescription(event.target.value)}
						placeholder="When to run it and what it covers"
						className={inputClassName}
					/>
				</div>

				<fieldset>
					<legend className="text-base font-semibold text-gray-700">
						Suites and sections
					</legend>
					<p className="mt-1 text-xs text-gray-500">
						Every test case in them, including the sections nested inside and
						test cases added later.
					</p>
					<ul className="mt-2 max-h-72 overflow-y-auto rounded-md border border-gray-200 bg-white p-2">
						{flattenTree(sectionTree(sections)).map(({ section, depth }) => {
							const isChosen = sectionIDs.includes(section.sectionID)
							const isIncluded =
								!isChosen && includedSections.has(section.sectionID)
							return (
								<li key={section.sectionID}>
									<label
										className="flex items-center gap-2 py-1 text-sm text-gray-700"
										style={{ paddingLeft: `${depth * 18}px` }}
									>
										<input
											type="checkbox"
											checked={isChosen || isIncluded}
											disabled={isIncluded}
											onChange={() =>
												setSectionIDs(toggle(sectionIDs, section.sectionID))
											}
											className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
										/>
										<span className={depth === 0 ? 'font-medium' : ''}>
											{section.name}
										</span>
										{isIncluded && (
											<span className="text-xs text-gray-500">included</span>
										)}
									</label>
								</li>
							)
						})}
					</ul>
				</fieldset>

				<fieldset>
					<legend className="text-base font-semibold text-gray-700">
						Labels
					</legend>
					<p className="mb-2 mt-1 text-xs text-gray-500">
						Every test case with any of the chosen labels, in any suite.
					</p>
					{labelOptions.length === 0 ? (
						<p className="text-sm text-gray-500">
							No test case has labels yet.
						</p>
					) : (
						<LabelFilter
							labels={labelOptions}
							selected={labels}
							onChange={setLabels}
						/>
					)}
				</fieldset>

				<fieldset>
					<legend className="text-base font-semibold text-gray-700">
						Test cases
					</legend>
					<p className="mt-1 text-xs text-gray-500">
						Chosen one by one, wherever they are.
					</p>
					<input
						type="search"
						value={search}
						onChange={(event) => setSearch(event.target.value)}
						placeholder="Search by title or ID"
						aria-label="Search test cases"
						className={inputClassName}
					/>
					<ul className="mt-2 max-h-72 divide-y divide-gray-200 overflow-y-auto rounded-md border border-gray-200 bg-white">
						{searchResults.length === 0 && (
							<li className="px-3 py-2 text-sm text-gray-500">
								{query
									? 'No test cases found'
									: 'Search to choose test cases one by one'}
							</li>
						)}
						{searchResults.slice(0, 100).map((testCase) => (
							<li key={testCase.testCaseID}>
								<label className="flex items-start gap-2 px-3 py-2 text-sm">
									<input
										type="checkbox"
										checked={testCaseIDs.includes(testCase.testCaseID)}
										onChange={() =>
											setTestCaseIDs(toggle(testCaseIDs, testCase.testCaseID))
										}
										className="mt-0.5 h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
									/>
									<span className="min-w-0">
										<span className="text-gray-500">
											{Tools.testCaseDisplayCode(project, testCase)}
										</span>{' '}
										<span className="text-gray-900">{testCase.title}</span>
										<span className="block truncate text-xs text-gray-500">
											{sectionPath(sections, testCase.sectionID)}
										</span>
									</span>
								</label>
							</li>
						))}
					</ul>
				</fieldset>

				<div className="flex justify-end gap-3">
					<button
						type="button"
						onClick={onCancel}
						className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
					>
						Cancel
					</button>
					<button
						type="submit"
						disabled={isSubmitting}
						className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
					>
						{isSubmitting ? 'Saving...' : 'Save test plan'}
					</button>
				</div>
			</div>

			{/* what the rules choose right now */}
			<aside className="h-fit rounded-md border border-gray-200 bg-white p-4 lg:sticky lg:top-4">
				<h3 className="text-sm font-semibold text-gray-900">
					{matches.length} test case{matches.length === 1 ? '' : 's'}
				</h3>
				<p className="mt-1 text-xs text-gray-500">
					Worked out again each time a run is started from the plan.
				</p>
				<div className="mt-3 max-h-[28rem] space-y-3 overflow-y-auto">
					{groups.map((group) => (
						<div key={group.section?.sectionID ?? 'unfiled'}>
							<div className="text-xs font-medium text-gray-500">
								{group.section
									? sectionPath(sections, group.section.sectionID)
									: 'No section'}
							</div>
							<ul className="mt-1 space-y-0.5 text-sm text-gray-700">
								{group.testCases.map((testCase) => (
									<li key={testCase.testCaseID} className="truncate">
										{testCase.title}
									</li>
								))}
							</ul>
						</div>
					))}
				</div>
			</aside>
		</form>
	)
}
