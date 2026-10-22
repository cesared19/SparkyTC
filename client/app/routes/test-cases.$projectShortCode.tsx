import { type LoaderFunctionArgs } from '@remix-run/node'
import { useLoaderData, Outlet } from '@remix-run/react'
import { ProjectShell } from '~/components/ProjectShell'
import {
	FetchResponse,
	ProjectTestCasesOutletContext,
	PropertyConfiguration,
	TestCase,
	TestCaseSection,
	SharedStep,
} from '~/models/types'
import { Project } from '~/models/project'
import { APIRoute } from '~/utility/Routes'
import { requireAPI } from '~/utility/API.server'

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

	const [testCasesData, propertiesData, sectionsData, sharedStepsData] =
		await Promise.all([
			api.get<FetchResponse<TestCase[]>>(
				APIRoute.projectTestCases(projectShortCode)
			),
			api.get<FetchResponse<PropertyConfiguration[]>>(APIRoute.properties),
			api.get<FetchResponse<TestCaseSection[]>>(
				APIRoute.projectSections(projectShortCode)
			),
			api.get<FetchResponse<SharedStep[]>>(
				APIRoute.projectSharedSteps(projectShortCode)
			),
		])

	return {
		project,
		projects: projectData.data,
		testCases: testCasesData.data,
		properties: propertiesData.data,
		sections: sectionsData.data,
		sharedSteps: sharedStepsData.data,
	}
}

export default function ProjectLayout() {
	const { project, projects, testCases, properties, sections, sharedSteps } =
		useLoaderData<typeof loader>()

	const outletContext: ProjectTestCasesOutletContext = {
		project,
		testCases,
		properties,
		sections,
		sharedSteps,
	}

	return (
		<ProjectShell projects={projects} currentProject={project}>
			<Outlet context={outletContext} />
		</ProjectShell>
	)
}
