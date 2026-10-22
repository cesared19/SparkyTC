import { type LoaderFunctionArgs } from '@remix-run/node'
import { Outlet, useLoaderData } from '@remix-run/react'
import { ProjectShell } from '~/components/ProjectShell'
import { Project } from '~/models/project'
import {
	FetchResponse,
	ProjectTestPlansOutletContext,
	TestCase,
	TestCaseSection,
	TestPlan,
	TestRun,
} from '~/models/types'
import { requireAPI } from '~/utility/API.server'
import { APIRoute } from '~/utility/Routes'

export async function loader({ request, params }: LoaderFunctionArgs) {
	const api = await requireAPI(request)
	const projectShortCode = params.projectShortCode
	if (!projectShortCode) {
		throw new Response('Project short code is required', { status: 400 })
	}

	// only lists the projects the user can access, so unknown and hidden projects both 404
	const projectData = await api.get<FetchResponse<Project[]>>(APIRoute.projects)
	const project = projectData.data.find(
		(project) => project.projectShortCode === projectShortCode
	)
	if (!project) {
		throw new Response('Project not found', { status: 404 })
	}

	const [testPlans, testCases, sections, testRuns] = await Promise.all([
		api.get<FetchResponse<TestPlan[]>>(
			APIRoute.projectTestPlans(projectShortCode)
		),
		api.get<FetchResponse<TestCase[]>>(
			APIRoute.projectTestCases(projectShortCode)
		),
		api.get<FetchResponse<TestCaseSection[]>>(
			APIRoute.projectSections(projectShortCode)
		),
		api.get<FetchResponse<TestRun[]>>(
			APIRoute.projectTestRuns(projectShortCode)
		),
	])

	return {
		project,
		projects: projectData.data,
		testPlans: testPlans.data,
		testCases: testCases.data,
		sections: sections.data,
		testRuns: testRuns.data,
	}
}

export default function TestPlansLayout() {
	const { project, projects, testPlans, testCases, sections, testRuns } =
		useLoaderData<typeof loader>()

	const context: ProjectTestPlansOutletContext = {
		project,
		testPlans,
		testCases,
		sections,
		testRuns,
	}

	return (
		<ProjectShell projects={projects} currentProject={project}>
			<Outlet context={context} />
		</ProjectShell>
	)
}
