import { Link, useOutletContext } from '@remix-run/react'
import { TestCaseFormat, TestCaseOutletContext } from '~/models/types'
import { BackButton } from '~/components/BackButton'
import { DateDisplay } from '~/components/DateDisplay'
import { LinkifiedText } from '~/components/LinkifiedText'
import { AttachmentGallery } from '~/components/AttachmentGallery'
import { JiraIssuesPanel } from '~/components/JiraIssuesPanel'
import { TestCaseHistory } from '~/components/TestCaseResults'
import { Route } from '~/utility/Routes'
import { sectionPath } from '~/utility/Sections'
import { LabelChip } from '~/components/LabelInput'
import { TestCaseStepsView } from '~/components/StepsView'

export default function TestCaseDetails() {
	const { project, testCase, propertyValues, sections } =
		useOutletContext<TestCaseOutletContext>()

	return (
		<div>
			<div className="flex items-center justify-between mb-4">
				<BackButton />
				<Link
					to="edit"
					className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
				>
					Edit Test Case
				</Link>
			</div>
			<div className="mb-4">
				<div className="flex flex-wrap items-center gap-x-4 gap-y-1">
					<h2 className="text-2xl font-semibold text-gray-900 flex items-center">
						{testCase.title}
					</h2>
					<span className="text-sm text-gray-500 flex items-center">
						{project.projectShortCode}-{testCase.testCaseNumber}
					</span>
				</div>
				{(testCase.labels?.length ?? 0) > 0 && (
					<div className="mt-2 flex flex-wrap gap-1.5">
						{testCase.labels?.map((label) => (
							<LabelChip key={label} label={label} />
						))}
					</div>
				)}
				{testCase.sectionID && (
					<Link
						to={`${Route.viewProjectTestCases(
							project.projectShortCode
						)}?section=${testCase.sectionID}`}
						className="mt-1 inline-block text-sm text-gray-500 hover:text-gray-900 hover:underline"
					>
						{sectionPath(sections, testCase.sectionID)}
					</Link>
				)}
			</div>

			<div className="space-y-8">
				<div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
					<div>
						<label className="block text-base font-semibold text-gray-700">
							Created
						</label>
						<DateDisplay
							date={testCase.creationDate}
							className="mt-1 text-sm text-gray-700"
						/>
						{testCase.createdBy && (
							<div className="text-sm text-gray-500">
								by {testCase.createdBy}
							</div>
						)}
						{testCase.updatedBy && testCase.modifyDate && (
							<div className="mt-1 text-xs text-gray-500">
								Last updated by {testCase.updatedBy} on{' '}
								{new Date(testCase.modifyDate).toLocaleString()}
							</div>
						)}
					</div>

					<div>
						<label className="block text-base font-semibold text-gray-700">
							Description
						</label>
						<div className="mt-1 text-sm text-gray-700 whitespace-pre-wrap">
							{testCase.description ? (
								<LinkifiedText text={testCase.description} />
							) : (
								'No description provided'
							)}
						</div>
					</div>
				</div>

				<div>
					<h3 className="text-xl font-semibold text-gray-900 mb-2">
						Properties
					</h3>
					<div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
						{propertyValues.map((propertyValue) => (
							<div
								key={
									propertyValue.propertyConfiguration.propertyConfigurationID
								}
							>
								<div className="text-sm font-medium text-gray-900">
									{propertyValue.propertyConfiguration.title}
								</div>
								<div className="mt-2 text-sm text-gray-700">
									{propertyValue.value ? (
										<LinkifiedText text={propertyValue.value} />
									) : (
										'Not set'
									)}
								</div>
							</div>
						))}
					</div>
				</div>

				{testCase.format === TestCaseFormat.steps ? (
					<div>
						<h3 className="text-xl font-semibold text-gray-900 mb-2">Steps</h3>
						<TestCaseStepsView steps={testCase.steps ?? []} />
					</div>
				) : (
					<div>
						<h3 className="text-xl font-semibold text-gray-900 mb-2">
							Test Instructions
						</h3>
						<div className="mt-1 text-sm text-gray-700 whitespace-pre-wrap">
							{testCase.testInstructions ? (
								<LinkifiedText text={testCase.testInstructions} />
							) : (
								'No test instructions provided'
							)}
						</div>
					</div>
				)}

				<div>
					<h3 className="text-xl font-semibold text-gray-900 mb-2">
						Jira Issues
					</h3>
					<JiraIssuesPanel
						testCaseID={testCase.testCaseID}
						links={testCase.jiraLinks ?? []}
						editable
					/>
				</div>

				<div>
					<h3 className="text-xl font-semibold text-gray-900 mb-2">
						Images and Videos
					</h3>
					<AttachmentGallery
						testCaseID={testCase.testCaseID}
						attachments={testCase.attachments ?? []}
						editable
					/>
				</div>

				<div id="history">
					<h3 className="text-xl font-semibold text-gray-900 mb-2">History</h3>
					<p className="mb-3 text-xs text-gray-500">
						Every result recorded for this test case in the project&apos;s test
						runs, newest first.
					</p>
					<TestCaseHistory
						testCaseID={testCase.testCaseID}
						projectShortCode={project.projectShortCode}
						testCaseNumber={testCase.testCaseNumber}
					/>
				</div>
			</div>
		</div>
	)
}
