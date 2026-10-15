import { type LoaderFunctionArgs } from '@remix-run/node'
import { useLoaderData, Outlet, useOutletContext } from '@remix-run/react'
import { APIRoute } from '~/utility/Routes'
import type {
	FetchResponse,
	ProjectTestCaseRunsOutletContext,
	ProjectTestRunsOutletContext,
	TestCaseRun,
	PropertyConfiguration,
} from '~/models/types'
import { APIClient } from '~/utility/APIClient'

export async function loader({ params }: LoaderFunctionArgs) {
	const projectShortCode = params.projectShortCode
	const testRunNumber = Number(params.testRunNumber)
	if (!projectShortCode) {
		throw new Response('Project ID is required', { status: 400 })
	}
	if (!testRunNumber) {
		throw new Response('Test run number is required', { status: 400 })
	}

	const [response, propertiesResponse] = await Promise.all([
		APIClient.get<FetchResponse<TestCaseRun[]>>(
			APIRoute.projectTestCaseRuns(projectShortCode, testRunNumber)
		),
		APIClient.get<FetchResponse<PropertyConfiguration[]>>(APIRoute.properties),
	])
	return {
		testRunNumber,
		testCaseRuns: response.data,
		properties: propertiesResponse.data,
	}
}

export default function TestRunsIndex() {
	const { testRunNumber, testCaseRuns, properties } =
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
	}

	return <Outlet context={outletContext} />
}
