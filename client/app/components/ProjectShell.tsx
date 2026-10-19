import { Link, NavLink, useFetcher } from '@remix-run/react'
import { Project } from '~/models/project'
import { useCurrentUser, useIsAdmin } from '~/utility/CurrentUser'
import { Route } from '~/utility/Routes'

interface ProjectShellProps {
	projects: Project[]
	currentProject: Project
	children: React.ReactNode
}

/**
 * Layout shared by every project page: the projects the user can access on the left and the
 * Dashboard | Test Cases | Test Runs | Builds tabs above the page content.
 */
export function ProjectShell({
	projects,
	currentProject,
	children,
}: ProjectShellProps) {
	const isAdmin = useIsAdmin()
	const tabs = [
		{
			to: Route.viewProjectDashboard(currentProject.projectShortCode),
			label: 'Dashboard',
			end: true,
		},
		{
			to: Route.viewProjectTestCases(currentProject.projectShortCode),
			label: 'Test Cases',
		},
		{
			to: Route.viewProjectTestRuns(currentProject.projectShortCode),
			label: 'Test Runs',
		},
		{
			to: Route.viewProjectBuilds(currentProject.projectShortCode),
			label: 'Builds',
		},
		...(isAdmin
			? [
					{
						to: Route.projectSettings(currentProject.projectShortCode),
						label: 'Settings',
					},
			  ]
			: []),
	]

	return (
		<div className="flex min-h-0 flex-1">
			<ProjectList projects={projects} currentProject={currentProject} />
			<div className="flex min-w-0 flex-1 flex-col">
				<div className="border-b border-gray-200 bg-white px-6 pt-4">
					<div className="flex items-baseline gap-3">
						<h1 className="text-xl font-semibold text-gray-900">
							{currentProject.title}
						</h1>
						<span className="text-sm text-gray-500">
							{currentProject.projectShortCode}
						</span>
					</div>
					{currentProject.description && (
						<p className="mt-1 line-clamp-2 text-sm text-gray-500">
							{currentProject.description}
						</p>
					)}
					<nav className="-mb-px mt-3 flex gap-6" aria-label="Project views">
						{tabs.map((tab) => (
							<NavLink
								key={tab.to}
								to={tab.to}
								end={'end' in tab && tab.end}
								className={({ isActive }) =>
									`border-b-2 px-1 pb-3 text-sm font-medium ${
										isActive
											? 'border-brand-500 text-brand-600'
											: 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
									}`
								}
							>
								{tab.label}
							</NavLink>
						))}
					</nav>
				</div>
				<div className="flex-1 overflow-auto p-6">{children}</div>
			</div>
		</div>
	)
}

interface ProjectListProps {
	projects: Project[]
	currentProject?: Project
}

export function ProjectList({ projects, currentProject }: ProjectListProps) {
	const user = useCurrentUser()
	const isAdmin = useIsAdmin()
	const fetcher = useFetcher()

	// reflect a default project change immediately, before the user data reloads
	const pending = fetcher.json as
		| { projectShortCode?: string | null }
		| undefined
	const defaultProject =
		pending !== undefined
			? pending.projectShortCode ?? undefined
			: user?.defaultProjectShortCode

	const toggleDefault = (project: Project) => {
		const isDefault = defaultProject === project.projectShortCode
		fetcher.submit(
			{
				intent: 'defaultProject',
				projectShortCode: isDefault ? null : project.projectShortCode,
			},
			{ method: 'post', action: Route.preferences, encType: 'application/json' }
		)
	}

	return (
		<aside className="flex w-64 shrink-0 flex-col border-r border-gray-200 bg-white">
			<div className="flex items-center justify-between px-4 pb-2 pt-4">
				<h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
					Projects
				</h2>
				{isAdmin && (
					<Link
						to={Route.newProject}
						className="text-xs font-medium text-brand-600 hover:text-brand-800"
					>
						+ New
					</Link>
				)}
			</div>
			<nav className="flex-1 space-y-0.5 overflow-auto px-2 pb-4">
				{projects.map((project) => {
					const isCurrent =
						project.projectShortCode === currentProject?.projectShortCode
					const isDefault = project.projectShortCode === defaultProject
					return (
						<div
							key={project.projectID}
							className={`group flex items-center rounded-md ${
								isCurrent ? 'bg-brand-50' : 'hover:bg-gray-50'
							}`}
						>
							<Link
								to={Route.viewProjectDashboard(project.projectShortCode)}
								className="min-w-0 flex-1 px-3 py-2"
								aria-current={isCurrent ? 'page' : undefined}
							>
								<span
									className={`block truncate text-sm font-medium ${
										isCurrent ? 'text-brand-600' : 'text-gray-700'
									}`}
								>
									{project.title}
								</span>
								<span className="block text-xs text-gray-500">
									{project.projectShortCode}
								</span>
							</Link>
							<button
								type="button"
								onClick={() => toggleDefault(project)}
								title={
									isDefault
										? 'Default project (click to unset)'
										: 'Set as default project'
								}
								aria-label={
									isDefault
										? `Unset ${project.title} as default project`
										: `Set ${project.title} as default project`
								}
								aria-pressed={isDefault}
								className={`mr-2 rounded p-1 text-base leading-none ${
									isDefault
										? 'text-amber-500'
										: 'text-gray-400 opacity-0 hover:text-amber-500 focus:opacity-100 group-hover:opacity-100'
								}`}
							>
								{isDefault ? '★' : '☆'}
							</button>
						</div>
					)
				})}
				{projects.length === 0 && (
					<p className="px-3 py-2 text-sm text-gray-500">No projects</p>
				)}
			</nav>
		</aside>
	)
}
