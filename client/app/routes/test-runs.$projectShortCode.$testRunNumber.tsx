import { type LoaderFunctionArgs } from '@remix-run/node'
import { useLoaderData, Outlet, useOutletContext } from '@remix-run/react'
import { APIRoute } from '~/utility/Routes'
import type {
	FetchResponse,
	ProjectBuild,
	ProjectTestCaseRunsOutletContext,
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

	const [response, propertiesResponse, usersResponse, buildsResponse] =
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
		])
	return {
		testRunNumber,
		testCaseRuns: response.data,
		properties: propertiesResponse.data,
		projectUsers: usersResponse.data,
		builds: buildsResponse.data,
	}
}

export default function TestRunsIndex() {
	const { testRunNumber, testCaseRuns, properties, projectUsers, builds } =
		useLoaderData<typeof loader>()
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
	}

	return <Outlet context={outletContext} />
}
