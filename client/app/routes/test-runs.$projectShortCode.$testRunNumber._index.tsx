import { type ActionFunctionArgs, redirect } from '@remix-run/node'
import {
	useNavigate,
	useSubmit,
	useOutletContext,
	useFetcher,
	Link,
} from '@remix-run/react'
import { Route, APIRoute } from '~/utility/Routes'
import {
	FetchResponse,
	ProjectTestCaseRunsOutletContext,
	TestRun,
	TestRunStatus,
} from '~/models/types'
import type { UpdateTestRun } from '~/models/types'
import { ActionMenu, type ActionMenuItem } from '~/components/ActionMenu'
import { TestRunStatusBadge } from '~/components/TestRunStatusBadge'
import { TestCaseRunStatusBadge } from '~/components/TestCaseRunStatusBadge'
import { Table, type Column } from '~/components/Table'
import type { TestCaseRun } from '~/models/types'
import { Tools } from '~/utility/Tools'
import { BackButton } from '~/components/BackButton'
import { DateDisplay } from '../components/DateDisplay'
import { requireAPI } from '~/utility/API.server'
import { useIsAdmin } from '~/utility/CurrentUser'
import { TestCaseAssignment, TestRunAssignees } from '~/components/Assignments'
import { TestRunBuild } from '~/components/Builds'
import { TestRunReportButton } from '~/components/TestRunReportButton'
import { RerunDialog } from '~/components/RerunDialog'
import { useState } from 'react'
import { formatDuration, TestRunTimeSection } from '~/components/TimeTracking'
import { TestCaseRunStatus } from '~/models/types'

export async function action({ request, params }: ActionFunctionArgs) {
	const api = await requireAPI(request)
	const projectShortCode = params.projectShortCode
	if (!projectShortCode) {
		throw new Response('Project short code is required', { status: 400 })
	}

	const requestJSON = await request.json()

	if (requestJSON.intent === 'update') {
		const { testRunUpdate, testRunID } = requestJSON
		await api.put<void>(APIRoute.testRun(testRunID), {
			body: testRunUpdate,
		})

		return redirect(Route.viewProjectTestRuns(projectShortCode))
	} else if (requestJSON.intent === 'rerun') {
		const { testRunID, rerun } = requestJSON
		try {
			const response = await api.post<FetchResponse<TestRun>>(
				APIRoute.rerunTestRun(testRunID),
				{ body: rerun }
			)
			return redirect(
				Route.viewTestRun(projectShortCode, response.data.testRunNumber)
			)
		} catch (error) {
			return Response.json(Tools.mapErrorToResponse(error), { status: 400 })
		}
	} else if (requestJSON.intent === 'delete') {
		const { testRunID } = requestJSON
		await api.delete<void>(APIRoute.testRun(testRunID))

		return redirect(Route.viewProjectTestRuns(projectShortCode))
	} else {
		throw new Response('Invalid request', { status: 400 })
	}
}

export default function TestRunDetails() {
	const { project, testRun, testCaseRuns, projectUsers, builds, time } =
		useOutletContext<ProjectTestCaseRunsOutletContext>()

	const navigate = useNavigate()
	const [showRerun, setShowRerun] = useState(false)
	const submit = useSubmit()
	const isAdmin = useIsAdmin()

	const allMenuItems: ActionMenuItem[] = (() => {
		const deleteItem: ActionMenuItem = {
			label: 'Delete test run',
			action: () => {
				if (
					window.confirm(
						'Are you sure you want to delete this test run? This action cannot be undone.'
					)
				) {
					submit(
						{ intent: 'delete', testRunID: testRun.testRunID },
						{
							method: 'POST',
							encType: 'application/json',
						}
					)
				}
			},
			variant: 'danger',
		}

		const editItem: ActionMenuItem = {
			label: 'Edit test run',
			action: () => {
				navigate('edit')
			},
		}

		const rerunItem: ActionMenuItem = {
			label: 'Re-run test cases',
			action: () => setShowRerun(true),
		}

		switch (testRun.status) {
			case TestRunStatus.pending:
			case TestRunStatus.inProgress:
				return [
					{
						label: 'Abort test run',
						action: () => {
							const testRunUpdate: UpdateTestRun = {
								title: testRun.title,
								description: testRun.description,
								status: TestRunStatus.abort,
							}

							submit(
								{
									intent: 'update',
									testRunUpdate,
									testRunID: testRun.testRunID,
								},
								{
									method: 'POST',
									encType: 'application/json',
								}
							)
						},
					},
					editItem,
					rerunItem,
					deleteItem,
				]
			case TestRunStatus.abort:
				return [
					{
						label: 'Resume test run',
						action: () => {
							const testRunUpdate: UpdateTestRun = {
								title: testRun.title,
								description: testRun.description,
								status: TestRunStatus.pending,
							}

							submit(
								{
									intent: 'update',
									testRunUpdate,
									testRunID: testRun.testRunID,
								},
								{
									method: 'POST',
									encType: 'application/json',
								}
							)
						},
					},
					editItem,
					rerunItem,
					deleteItem,
				]
			case TestRunStatus.complete:
				return [editItem, rerunItem, deleteItem]
			default:
				return [editItem, rerunItem, deleteItem]
		}
	})()
	// deleting test runs is restricted to admins
	const menuItems = isAdmin
		? allMenuItems
		: allMenuItems.filter((item) => item.label !== 'Delete test run')

	const timeColumn: Column<TestCaseRun> = {
		header: 'Time',
		key: 'time',
		render: (testCaseRun: TestCaseRun) => (
			<span className="text-sm tabular-nums text-gray-700">
				{testCaseRun.timeSeconds > 0
					? formatDuration(testCaseRun.timeSeconds)
					: '-'}
				{testCaseRun.runningTimers.length > 0 && (
					<span className="ml-1 text-xs text-brand-600">running</span>
				)}
			</span>
		),
	}

	const columns: Column<TestCaseRun>[] = [
		{
			header: 'ID',
			key: 'id',
			mobile: 'subtitle',
			render: (testCaseRun) => (
				<>
					{Tools.testCaseDisplayCode(project, testCaseRun.testCase)}
					{testCaseRun.testCase.isArchived && (
						<span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
							Archived
						</span>
					)}
				</>
			),
		},
		{
			header: 'Title',
			key: 'title',
			mobile: 'title',
			render: (testCaseRun) => testCaseRun.title,
		},
		{
			header: 'Status',
			key: 'status',
			render: (testCaseRun) => (
				<TestCaseRunStatusBadge status={testCaseRun.status} />
			),
		},
		{
			header: 'Assigned to',
			key: 'assignedTo',
			render: (testCaseRun) => (
				<TestCaseAssignment
					testRun={testRun}
					testCaseRun={testCaseRun}
					projectUsers={projectUsers}
					compact
				/>
			),
		},
		...(testRun.trackTime ? [timeColumn] : []),
		{
			header: 'Completed by',
			key: 'completedBy',
			render: (testCaseRun) =>
				testCaseRun.status !== TestCaseRunStatus.pending &&
				testCaseRun.executedBy ? (
					<span className="text-sm text-gray-700">
						{testCaseRun.executedBy}
					</span>
				) : (
					<span className="text-sm text-gray-500">-</span>
				),
		},
	]

	return (
		<div>
			<div className="flex items-center justify-between mb-4">
				<BackButton />
			</div>
			<div className="mb-6 flex flex-col-reverse items-start justify-between gap-3 sm:flex-row">
				<div>
					<h1 className="text-2xl font-semibold text-gray-900">
						{testRun.title}
					</h1>
					{testRun.createdBy && (
						<p className="mt-1 text-sm text-gray-500">
							Created by {testRun.createdBy}
						</p>
					)}
					<div className="mt-4">
						<h3 className="text-lg font-medium text-gray-900 mb-1">
							Assigned to
						</h3>
						<TestRunAssignees
							key={testRun.assignees.map((user) => user.userID).join()}
							testRun={testRun}
							projectUsers={projectUsers}
						/>
					</div>
					<div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
						<div>
							<h3 className="text-lg font-medium text-gray-900 mb-1">Status</h3>
							<TestRunStatusBadge status={testRun.status} />
						</div>
						<div>
							<h3 className="text-lg font-medium text-gray-900 mb-1">Build</h3>
							<TestRunBuild testRun={testRun} builds={builds} />
						</div>
						<div>
							<h3 className="text-lg font-medium text-gray-900 mb-1">
								Description
							</h3>
							<p className="text-gray-700 mb-4">
								{testRun.description || 'No description provided'}
							</p>
						</div>
					</div>
					{testRun.trackTime && (
						<div className="mt-4">
							<h3 className="text-lg font-medium text-gray-900 mb-1">
								Time spent
							</h3>
							<TestRunTimeSection testRun={testRun} time={time} />
						</div>
					)}
				</div>
				<div className="flex items-start gap-2 self-end sm:self-start">
					<TestRunReportButton
						project={project}
						testRun={testRun}
						testCaseRuns={testCaseRuns}
						time={time}
					/>
					<ActionMenu items={menuItems} label="Test Run Settings" />
				</div>
			</div>

			<h3 className="text-lg font-medium text-gray-900 mb-4">Test Cases</h3>
			<Table
				tableRows={testCaseRuns.map((testCaseRun) => ({
					id: testCaseRun.testCaseRunID,
					data: testCaseRun,
				}))}
				columns={columns}
				onRowClick={(testCaseRun) =>
					navigate(testCaseRun.testCase.testCaseNumber.toString())
				}
			/>
			{showRerun && (
				<RerunDialog
					testRun={testRun}
					testCaseRuns={testCaseRuns}
					builds={builds}
					onClose={() => setShowRerun(false)}
				/>
			)}
		</div>
	)
}
