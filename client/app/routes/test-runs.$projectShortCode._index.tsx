import { type LoaderFunctionArgs } from '@remix-run/node'
import {
	Link,
	useLoaderData,
	useNavigate,
	useSearchParams,
} from '@remix-run/react'
import { useEffect } from 'react'
import { FetchResponse, TestRun } from '~/models/types'
import { requireAPI } from '~/utility/API.server'
import { APIRoute } from '~/utility/Routes'
import { TestRunStatusBadge } from '~/components/TestRunStatusBadge'
import { Table, Column } from '~/components/Table'
import { DateDisplay } from '~/components/DateDisplay'
import {
	DEFAULT_TEST_RUN_SORT,
	isTestRunSort,
	sortTestRuns,
	TEST_RUN_SORTS,
	type TestRunSort,
} from '~/utility/TestRunSort'

// the last order chosen, used when the list is opened without one in the address
const SORT_STORAGE_KEY = 'sparkytc.testRunSort'

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
	// the order is kept in the address so it survives going back from a test run
	const [searchParams, setSearchParams] = useSearchParams()
	const requested = searchParams.get('sort')
	const sort = isTestRunSort(requested) ? requested : DEFAULT_TEST_RUN_SORT

	const chooseSort = (next: TestRunSort) => {
		try {
			localStorage.setItem(SORT_STORAGE_KEY, next)
		} catch {
			// storage can be unavailable, e.g. in private windows
		}
		setSearchParams(next === DEFAULT_TEST_RUN_SORT ? {} : { sort: next }, {
			replace: true,
			preventScrollReset: true,
		})
	}

	// without an order in the address, use the one chosen last time
	useEffect(() => {
		if (requested) return
		let saved: string | null = null
		try {
			saved = localStorage.getItem(SORT_STORAGE_KEY)
		} catch {
			return
		}
		if (isTestRunSort(saved) && saved !== DEFAULT_TEST_RUN_SORT) {
			setSearchParams(
				{ sort: saved },
				{ replace: true, preventScrollReset: true }
			)
		}
	}, [requested, setSearchParams])

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
			header: 'Build',
			key: 'build',
			render: (testRun) => testRun.build?.buildNumber ?? '-',
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

				<div className="flex flex-wrap items-center gap-3">
					<label
						htmlFor="testRunSort"
						className="flex items-center gap-2 text-sm text-gray-700"
					>
						Sort by
						<select
							id="testRunSort"
							value={sort}
							onChange={(event) =>
								chooseSort(event.target.value as TestRunSort)
							}
							className="rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
						>
							{TEST_RUN_SORTS.map((option) => (
								<option key={option.value} value={option.value}>
									{option.label}
								</option>
							))}
						</select>
					</label>
					<Link
						to="new"
						className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
					>
						Create Test Run
					</Link>
				</div>
			</div>
			<Table
				tableRows={sortTestRuns(testRuns, sort).map((testRun) => ({
					id: testRun.testRunID,
					data: testRun,
				}))}
				columns={columns}
				onRowClick={(testRun) => navigate(testRun.testRunNumber.toString())}
			/>
		</div>
	)
}
