import { type LoaderFunctionArgs, redirect } from '@remix-run/node'
import { Link, useLoaderData } from '@remix-run/react'
import { ProjectList } from '~/components/ProjectShell'
import { Project } from '~/models/project'
import { FetchResponse } from '~/models/types'
import { requireUser } from '~/utility/Authorization.server'
import { useIsAdmin } from '~/utility/CurrentUser'
import { APIRoute, Route } from '~/utility/Routes'

// landing page after signing in: opens the user's default project, or the first one they can access
export async function loader({ request }: LoaderFunctionArgs) {
	const { api, user } = await requireUser(request)
	const projects = await api.get<FetchResponse<Project[]>>(APIRoute.projects)

	const target =
		projects.data.find(
			(project) => project.projectShortCode === user.defaultProjectShortCode
		) ?? projects.data[0]
	if (target) {
		return redirect(Route.viewProjectDashboard(target.projectShortCode))
	}
	return { projects: projects.data }
}

export default function Home() {
	const { projects } = useLoaderData<typeof loader>()
	const isAdmin = useIsAdmin()

	return (
		<div className="flex min-h-0 flex-1">
			<ProjectList projects={projects} className="hidden md:flex" />
			<main className="flex flex-1 items-center justify-center p-6">
				<div className="max-w-sm text-center">
					<h2 className="text-lg font-semibold text-gray-900">
						No projects yet
					</h2>
					{isAdmin ? (
						<p className="mt-2 text-sm text-gray-600">
							Create the first project to start adding test cases.{' '}
							<Link
								to={Route.newProject}
								className="text-brand-600 hover:underline"
							>
								New project
							</Link>
						</p>
					) : (
						<p className="mt-2 text-sm text-gray-600">
							You don&apos;t have access to any project yet. Ask an admin to add
							you to one.
						</p>
					)}
				</div>
			</main>
		</div>
	)
}
