import { type LoaderFunctionArgs } from '@remix-run/node'
import { useLoaderData, Outlet } from '@remix-run/react'
import { APIRoute } from '~/utility/Routes'
import type {
	FetchResponse,
	ProjectTestRunsOutletContext,
} from '~/models/types'
import { ProjectShell } from '~/components/ProjectShell'
import { Project } from '../models/project'
import { requireAPI } from '~/utility/API.server'

export async function loader({ request, params }: LoaderFunctionArgs) {
	const api = await requireAPI(request)
	const projectShortCode = params.projectShortCode
	if (!projectShortCode) {
		throw new Response('Project ID is required', { status: 400 })
	}

	// only lists the projects the user can access, so unknown and hidden projects both 404
	const projectData = await api.get<FetchResponse<Project[]>>(APIRoute.projects)
	const project = projectData.data.find(
		(project) => project.projectShortCode === projectShortCode
	)
	if (!project) {
		throw new Response('Project not found', { status: 404 })
	}

	return { project, projects: projectData.data }
}

export default function TestRunsIndex() {
	const { project, projects } = useLoaderData<typeof loader>()

	const outletContext: ProjectTestRunsOutletContext = {
		project,
	}

	return (
		<ProjectShell projects={projects} currentProject={project}>
			<Outlet context={outletContext} />
		</ProjectShell>
	)
}
