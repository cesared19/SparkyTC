import { type LoaderFunctionArgs } from '@remix-run/node'
import { useLoaderData, Outlet } from '@remix-run/react'
import ProjectSidebar from '~/components/ProjectSidebar'
import {
	FetchResponse,
	ProjectTestCasesOutletContext,
	PropertyConfiguration,
	TestCase,
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

	const [projectData, testCasesData, propertiesData] = await Promise.all([
		api.get<FetchResponse<Project[]>>(APIRoute.projects),
		api.get<FetchResponse<TestCase[]>>(
			APIRoute.projectTestCases(projectShortCode)
		),
		api.get<FetchResponse<PropertyConfiguration[]>>(APIRoute.properties),
	])

	const project = projectData.data.find(
		(project) => project.projectShortCode === projectShortCode
	)
	if (!project) {
		throw new Response('Project not found', { status: 404 })
	}

	return {
		project,
		testCases: testCasesData.data,
		properties: propertiesData.data,
	}
}

export default function ProjectLayout() {
	const { project, testCases, properties } = useLoaderData<typeof loader>()

	const outletContext: ProjectTestCasesOutletContext = {
		project,
		testCases,
		properties,
	}

	return (
		<div className="flex h-full">
			<ProjectSidebar
				projectShortCode={project.projectShortCode}
				title={project.title}
				description={project.description}
			/>
			<div className="flex-1 overflow-auto p-6">
				<Outlet context={outletContext} />
			</div>
		</div>
	)
}
