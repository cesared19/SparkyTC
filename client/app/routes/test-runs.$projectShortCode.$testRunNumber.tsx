import { type LoaderFunctionArgs } from '@remix-run/node'
import { useLoaderData, Outlet, useOutletContext } from '@remix-run/react'
import { APIRoute } from '~/utility/Routes'
import type {
	FetchResponse,
	ProjectBuild,
	ProjectTestCaseRunsOutletContext,
	TestRun,
	TestRunTime,
	ProjectTestRunsOutletContext,
	TestCaseRun,
	PropertyConfiguration,
	UserSummary,
} from '~/models/types'
import { requireAPI } from '~/utility/API.server'

export async function loader({ request, params }: LoaderFunctionArgs) {
	const api = await requireAPI(request)
	const projectShortCode = params.projectShortCode
	const testRunNumber = Number(params.testRunNumber)
	if (!projectShortCode) {
		throw new Response('Project ID is required', { status: 400 })
	}
	if (!testRunNumber) {
		throw new Response('Test run number is required', { status: 400 })
	}

	const [response, propertiesResponse, usersResponse, buildsResponse, runs] =
		await Promise.all([
			api.get<FetchResponse<TestCaseRun[]>>(
				APIRoute.projectTestCaseRuns(projectShortCode, testRunNumber)
			),
			api.get<FetchResponse<PropertyConfiguration[]>>(APIRoute.properties),
			api.get<FetchResponse<UserSummary[]>>(
				APIRoute.projectUsers(projectShortCode)
			),
			api.get<FetchResponse<ProjectBuild[]>>(
				APIRoute.projectBuilds(projectShortCode)
			),
			api.get<FetchResponse<TestRun[]>>(
				APIRoute.projectTestRuns(projectShortCode)
			),
		])
	const testRun = runs.data.find((run) => run.testRunNumber === testRunNumber)
	if (!testRun) {
		throw new Response('Test run not found', { status: 404 })
	}
	const time = await api.get<FetchResponse<TestRunTime>>(
		APIRoute.testRunTime(testRun.testRunID)
	)
	return {
		testRunNumber,
		testCaseRuns: response.data,
		properties: propertiesResponse.data,
		projectUsers: usersResponse.data,
		builds: buildsResponse.data,
		time: time.data,
	}
}

export default function TestRunsIndex() {
	const {
		testRunNumber,
		testCaseRuns,
		properties,
		projectUsers,
		builds,
		time,
	} = useLoaderData<typeof loader>()
	const { project, testRuns } = useOutletContext<ProjectTestRunsOutletContext>()
	const testRun = testRuns.find(
		(testRun) => testRun.testRunNumber === testRunNumber
	)
	if (!testRun) {
		return <p>Test run not found</p>
	}

	const outletContext: ProjectTestCaseRunsOutletContext = {
		project,
		testRun,
		testCaseRuns,
		properties,
		projectUsers,
		builds,
		time,
	}

	return <Outlet context={outletContext} />
}
