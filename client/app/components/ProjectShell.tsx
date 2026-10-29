import { Link, NavLink, useFetcher, useLocation } from '@remix-run/react'
import { useEffect, useState } from 'react'
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
 * Dashboard | Test Cases | Test Plans | Test Runs | Builds tabs above the page content.
 */
export function ProjectShell({
	projects,
	currentProject,
	children,
}: ProjectShellProps) {
	const isAdmin = useIsAdmin()
	const location = useLocation()
	// on phones the project list opens as a drawer
	const [isListOpen, setIsListOpen] = useState(false)
	useEffect(() => setIsListOpen(false), [location.pathname])
	const settingsTab = {
		to: Route.projectSettings(currentProject.projectShortCode),
		label: 'Settings',
	}
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
			to: Route.viewTestPlans(currentProject.projectShortCode),
			label: 'Test Plans',
		},
		{
			to: Route.viewProjectTestRuns(currentProject.projectShortCode),
			label: 'Test Runs',
		},
		{
			to: Route.viewProjectBuilds(currentProject.projectShortCode),
			label: 'Builds',
		},
		...(isAdmin ? [settingsTab] : []),
	]

	return (
		<div className="flex min-h-0 flex-1">
			<ProjectList
				projects={projects}
				currentProject={currentProject}
				className="hidden md:flex"
			/>
			{isListOpen && (
				<div className="fixed inset-0 z-40 flex md:hidden">
					<ProjectList
						projects={projects}
						currentProject={currentProject}
						className="flex w-72 max-w-[85vw] shadow-xl"
					/>
					<button
						type="button"
						aria-label="Close projects"
						onClick={() => setIsListOpen(false)}
						className="flex-1 bg-gray-950/40"
					/>
				</div>
			)}
			<div className="flex min-w-0 flex-1 flex-col">
				<div className="border-b border-gray-200 bg-white px-4 pt-4 md:px-6">
					<div className="flex items-baseline gap-3">
						<button
							type="button"
							onClick={() => setIsListOpen(true)}
							aria-label="Switch project"
							className="-ml-1 self-center rounded-md p-1 text-gray-600 hover:bg-gray-100 md:hidden"
						>
							<svg
								className="h-5 w-5"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
								strokeWidth="2"
								aria-hidden="true"
							>
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									d="M4 6h16M4 12h10M4 18h16"
								/>
							</svg>
						</button>
						<h1 className="min-w-0 truncate text-xl font-semibold text-gray-900">
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
					<nav
						className="-mx-4 -mb-px mt-3 flex gap-4 overflow-x-auto px-4 md:mx-0 md:gap-6 md:px-0"
						aria-label="Project views"
					>
						{tabs.map((tab) => (
							<NavLink
								key={tab.to}
								to={tab.to}
								end={'end' in tab && tab.end}
								className={({ isActive }) =>
									`shrink-0 whitespace-nowrap border-b-2 px-1 pb-3 text-sm font-medium ${
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
				{/* relative keeps hidden, absolutely positioned elements (sr-only) inside this scrolling area;
				otherwise they stretch the page and it scrolls as a whole, leaving blank space */}
				<div className="relative flex-1 overflow-auto p-4 md:p-6">
					{children}
				</div>
			</div>
		</div>
	)
}

interface ProjectListProps {
	projects: Project[]
	currentProject?: Project
	// controls visibility and width, a fixed sidebar by default
	className?: string
}

export function ProjectList({
	projects,
	currentProject,
	className = 'flex',
}: ProjectListProps) {
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
		<aside
			className={`w-64 shrink-0 flex-col border-r border-gray-200 bg-white ${className}`}
		>
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
			<nav className="relative flex-1 space-y-0.5 overflow-auto px-2 pb-4">
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
