import {
	Link,
	useNavigate,
	useOutletContext,
	useSearchParams,
} from '@remix-run/react'
import { ProjectTestCasesOutletContext, TestCase } from '~/models/types'
import { Table, type Column } from '~/components/Table'
import { DateDisplay } from '~/components/DateDisplay'
import { SectionTree } from '~/components/SectionTree'
import { ExportMenu } from '~/components/ExportMenu'
import { BulkEditBar, SelectToggle } from '~/components/BulkEditBar'
import { Checkbox } from '~/components/Checkbox'
import { useIsAdmin } from '~/utility/CurrentUser'
import { useState } from 'react'
import { downloadTable, testCaseRows } from '~/utility/TestCaseExport'
import {
	hasAllLabels,
	LabelChip,
	LabelFilter,
	projectLabels,
} from '~/components/LabelInput'
import {
	groupBySection,
	sectionAndDescendants,
	sectionPath,
} from '~/utility/Sections'

export default function TestCasesIndex() {
	const { project, testCases, properties, sections } =
		useOutletContext<ProjectTestCasesOutletContext>()
	const navigate = useNavigate()
	const isAdmin = useIsAdmin()
	// while selecting, a click on a row chooses it for the bulk actions instead of opening it
	const [isSelecting, setIsSelecting] = useState(false)
	const [selectedIDs, setSelectedIDs] = useState<Set<string>>(new Set())
	// select all calls it for each row, so it builds on the latest selection
	const toggleSelected = (testCase: TestCase) =>
		setSelectedIDs((previous) => {
			const next = new Set(previous)
			if (next.has(testCase.testCaseID)) next.delete(testCase.testCaseID)
			else next.add(testCase.testCaseID)
			return next
		})
	const changeSelecting = (selecting: boolean) => {
		setIsSelecting(selecting)
		setSelectedIDs(new Set())
	}
	// the chosen section is kept in the address so it survives going back from a test case
	const [searchParams, setSearchParams] = useSearchParams()
	const selectedID = sections.some(
		(section) => section.sectionID === searchParams.get('section')
	)
		? (searchParams.get('section') as string)
		: undefined

	// several labels show the test cases that have all of them
	const selectedLabels = searchParams.getAll('label')
	const updateSearch = (sectionID: string | undefined, labels: string[]) => {
		const next = new URLSearchParams()
		if (sectionID) next.set('section', sectionID)
		labels.forEach((label) => next.append('label', label))
		setSearchParams(next, { replace: true, preventScrollReset: true })
	}
	const selectSection = (sectionID?: string) =>
		updateSearch(sectionID, selectedLabels)

	const visibleIDs = selectedID
		? sectionAndDescendants(sections, selectedID)
		: undefined
	const isVisible = (testCase: TestCase) =>
		!visibleIDs || (!!testCase.sectionID && visibleIDs.has(testCase.sectionID))
	const visibleTestCases = testCases.filter(
		(testCase) => isVisible(testCase) && hasAllLabels(testCase, selectedLabels)
	)
	const groups = groupBySection(sections, visibleTestCases)
	// only the ones on screen, so a filter never changes hidden test cases
	const selectedTestCases = visibleTestCases.filter((testCase) =>
		selectedIDs.has(testCase.testCaseID)
	)

	// Find property configuration IDs for priority and type
	const priorityConfig = properties.find(
		(p) => p.title.toLowerCase() === 'priority'
	)
	const typeConfig = properties.find((p) => p.title.toLowerCase() === 'type')

	const selectColumn: Column<TestCase> = {
		key: 'select',
		render: (testCase) => (
			<Checkbox isSelected={selectedIDs.has(testCase.testCaseID)} />
		),
	}

	const columns: Column<TestCase>[] = [
		...(isSelecting ? [selectColumn] : []),
		{
			header: 'ID',
			key: 'testCaseNumber',
			mobile: 'subtitle',
			render: (testCase) =>
				`${project.projectShortCode}-${testCase.testCaseNumber}`,
		},
		{
			header: 'Title',
			key: 'title',
			mobile: 'title',
			render: (testCase) => testCase.title,
		},
		{
			header: 'Labels',
			key: 'labels',
			render: (testCase) =>
				(testCase.labels?.length ?? 0) > 0 ? (
					<span className="flex flex-wrap gap-1">
						{testCase.labels?.map((label) => (
							<LabelChip key={label} label={label} />
						))}
					</span>
				) : (
					'-'
				),
		},
		{
			header: 'Priority',
			key: 'priority',
			render: (testCase) =>
				priorityConfig
					? testCase.propertyValues[priorityConfig.propertyConfigurationID] ||
					  '-'
					: '-',
		},
		{
			header: 'Type',
			key: 'type',
			render: (testCase) =>
				typeConfig
					? testCase.propertyValues[typeConfig.propertyConfigurationID] || '-'
					: '-',
		},
		{
			header: 'Created',
			key: 'creationDate',
			render: (testCase) => <DateDisplay date={testCase.creationDate} />,
		},
	]

	const tree = (
		<SectionTree
			projectShortCode={project.projectShortCode}
			sections={sections}
			testCases={testCases}
			selectedID={selectedID}
			onSelect={selectSection}
		/>
	)
	const newTestCasePath = selectedID ? `new?section=${selectedID}` : 'new'

	return (
		<div>
			<div className="mb-6 flex flex-wrap items-center justify-between gap-3">
				<h2 className="text-2xl font-semibold text-gray-900">Test Cases</h2>
				<div className="flex flex-wrap items-center gap-3">
					<SelectToggle isSelecting={isSelecting} onChange={changeSelecting} />
					<ExportMenu
						onExport={(format) =>
							downloadTable(
								`${project.projectShortCode}-test-cases`,
								'Test cases',
								testCaseRows(
									project,
									groups.flatMap((group) => group.testCases),
									properties,
									sections
								),
								format
							)
						}
					/>
					<Link
						to="shared-steps"
						className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
					>
						Shared steps
					</Link>
					<Link
						to={selectedID ? `import?section=${selectedID}` : 'import'}
						className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
					>
						Import CSV
					</Link>
					<Link
						to={newTestCasePath}
						className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
					>
						New Test Case
					</Link>
				</div>
			</div>

			<div className="flex flex-col gap-6 lg:flex-row lg:items-start">
				{/* on phones and tablets the tree folds above the list */}
				<details className="rounded-md border border-gray-200 bg-white lg:hidden">
					<summary className="cursor-pointer px-3 py-2 text-sm font-medium text-gray-900">
						Suites and sections
						{selectedID && (
							<span className="ml-2 font-normal text-gray-500">
								{sectionPath(sections, selectedID)}
							</span>
						)}
					</summary>
					<div className="border-t border-gray-200 p-2">{tree}</div>
				</details>
				<aside className="hidden w-72 shrink-0 rounded-md border border-gray-200 bg-white p-2 lg:block">
					<h3 className="px-2 pb-1 text-xs font-medium uppercase tracking-wider text-gray-500">
						Suites and sections
					</h3>
					{tree}
				</aside>

				<div className="min-w-0 flex-1 space-y-8">
					<LabelFilter
						labels={projectLabels(testCases)}
						selected={selectedLabels}
						onChange={(labels) => updateSearch(selectedID, labels)}
					/>
					{groups.length === 0 && (
						<p className="text-sm text-gray-500">
							No test cases here yet.{' '}
							<Link
								to={newTestCasePath}
								className="text-brand-600 hover:underline"
							>
								Create one
							</Link>
						</p>
					)}
					{groups.map((group) => (
						<section key={group.section?.sectionID ?? 'unfiled'}>
							<h3 className="mb-2 text-sm font-semibold text-gray-700">
								{group.section
									? sectionPath(sections, group.section.sectionID)
									: 'No section'}
								<span className="ml-2 font-normal text-gray-500">
									{group.testCases.length}
								</span>
							</h3>
							<Table
								tableRows={group.testCases.map((testCase) => ({
									id: testCase.testCaseID,
									data: testCase,
									isSelected: isSelecting
										? selectedIDs.has(testCase.testCaseID)
										: undefined,
								}))}
								columns={columns}
								allowSelectAll={isSelecting}
								onRowClick={(testCase) =>
									isSelecting
										? toggleSelected(testCase)
										: navigate(testCase.testCaseNumber.toString())
								}
							/>
						</section>
					))}
					{isSelecting && (
						<BulkEditBar
							selected={selectedTestCases}
							testCases={testCases}
							sections={sections}
							properties={properties}
							isAdmin={isAdmin}
							onClear={() => setSelectedIDs(new Set())}
						/>
					)}
				</div>
			</div>
		</div>
	)
}
