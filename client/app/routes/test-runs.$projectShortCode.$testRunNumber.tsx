import { type LoaderFunctionArgs } from '@remix-run/node'
import { useLoaderData, Outlet, useOutletContext } from '@remix-run/react'
import { APIRoute } from '~/utility/Routes'
import type {
	FetchResponse,
	ProjectBuild,
	ProjectTestCaseRunsOutletContext,
	TestRun,
	TestRunTime,
	TestCaseSection,
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

	// the test run first, so an unknown number is a 404
	const testRunResponse = await api
		.get<FetchResponse<TestRun>>(
			APIRoute.projectTestRun(projectShortCode, testRunNumber)
		)
		.catch(() => undefined)
	const testRun = testRunResponse?.data
	if (!testRun) {
		throw new Response('Test run not found', { status: 404 })
	}

	const [
		response,
		propertiesResponse,
		usersResponse,
		buildsResponse,
		sectionsResponse,
		time,
	] = await Promise.all([
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
		api.get<FetchResponse<TestCaseSection[]>>(
			APIRoute.projectSections(projectShortCode)
		),
		api.get<FetchResponse<TestRunTime>>(
			APIRoute.testRunTime(testRun.testRunID)
		),
	])
	return {
		testRun,
		testCaseRuns: response.data,
		properties: propertiesResponse.data,
		projectUsers: usersResponse.data,
		builds: buildsResponse.data,
		time: time.data,
		sections: sectionsResponse.data,
	}
}

export default function TestRunsIndex() {
	const {
		testRun,
		testCaseRuns,
		properties,
		projectUsers,
		builds,
		time,
		sections,
	} = useLoaderData<typeof loader>()
	const { project } = useOutletContext<ProjectTestRunsOutletContext>()

	const outletContext: ProjectTestCaseRunsOutletContext = {
		project,
		testRun,
		testCaseRuns,
		properties,
		projectUsers,
		builds,
		time,
		sections,
	}

	return <Outlet context={outletContext} />
}
