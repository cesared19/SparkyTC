import { type LoaderFunctionArgs } from '@remix-run/node'
import { Link, useLoaderData, useNavigate } from '@remix-run/react'
import { FetchResponse, TestRun } from '~/models/types'
import { requireAPI } from '~/utility/API.server'
import { APIRoute } from '~/utility/Routes'
import { TestRunStatusBadge } from '~/components/TestRunStatusBadge'
import { Table, Column } from '~/components/Table'
import { DateDisplay } from '~/components/DateDisplay'

// only the list needs every test run; a test run's page loads just its own
export async function loader({ request, params }: LoaderFunctionArgs) {
	const api = await requireAPI(request)
	const response = await api.get<FetchResponse<TestRun[]>>(
		APIRoute.projectTestRuns(params.projectShortCode ?? '')
	)
	return { testRuns: response.data }
}

export default function TestRunsIndex() {
	const { testRuns } = useLoaderData<typeof loader>()
	const navigate = useNavigate()

	const columns: Column<TestRun>[] = [
		{
			header: 'Title',
			key: 'title',
			mobile: 'title',
			render: (testRun) => testRun.title,
		},
		{
			header: 'Status',
			key: 'status',
			render: (testRun) => <TestRunStatusBadge status={testRun.status} />,
		},
		{
			header: 'Created',
			key: 'creationDate',
			render: (testRun) => <DateDisplay date={testRun.creationDate} />,
		},
	]

	return (
		<div>
			<div className="mb-6 flex flex-wrap items-center justify-between gap-3">
				<div>
					<h1 className="text-2xl font-semibold text-gray-900">Test Runs</h1>
				</div>

				<Link
					to="new"
					className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
				>
					Create Test Run
				</Link>
			</div>
			<Table
				tableRows={testRuns.map((testRun) => ({
					id: testRun.testRunID,
					data: testRun,
				}))}
				columns={columns}
				onRowClick={(testRun) => navigate(testRun.testRunNumber.toString())}
			/>
		</div>
	)
}
