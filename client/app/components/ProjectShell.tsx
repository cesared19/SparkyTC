import { Link, NavLink, useFetcher, useLocation } from '@remix-run/react'
import { useEffect, useRef, useState } from 'react'
import { Project } from '~/models/project'
import { useCurrentUser, useIsAdmin } from '~/utility/CurrentUser'
import { moveItem, orderProjects } from '~/utility/ProjectOrder'
import {
	setProjectListHidden,
	useProjectListHidden,
} from '~/utility/ProjectListVisibility'
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
	const isListHidden = useProjectListHidden()
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
				className="hidden md:flex [html[data-project-list=hidden]_&]:md:hidden"
				canHide
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
						<button
							type="button"
							id="show-project-list"
							onClick={() => {
								setProjectListHidden(false)
								document.getElementById('hide-project-list')?.focus()
							}}
							aria-label="Show project list"
							aria-expanded={!isListHidden}
							title="Show project list"
							className="-ml-1 hidden self-center rounded-md p-1 text-gray-600 hover:bg-gray-100 [html[data-project-list=hidden]_&]:md:inline-flex"
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
	// offers a button to hide the list (the fixed sidebar of project pages, not the phone drawer)
	canHide?: boolean
}

export function ProjectList({
	projects,
	currentProject,
	className = 'flex',
	canHide = false,
}: ProjectListProps) {
	const user = useCurrentUser()
	const isAdmin = useIsAdmin()
	const fetcher = useFetcher()
	const orderFetcher = useFetcher()
	const [isReordering, setIsReordering] = useState(false)
	// the order while a project is being dragged, before it's dropped and saved
	const [dragOrder, setDragOrder] = useState<string[] | null>(null)
	const [draggingCode, setDraggingCode] = useState<string | null>(null)
	// the order just dropped, shown until the save takes over, so the list doesn't flash the old order
	const [droppedOrder, setDroppedOrder] = useState<string[] | null>(null)
	const [movedMessage, setMovedMessage] = useState('')
	const rows = useRef(new Map<string, HTMLElement>())
	const list = useRef<HTMLElement>(null)

	// reflect a default project change immediately, before the user data reloads
	const pending = fetcher.json as
		| { projectShortCode?: string | null }
		| undefined
	const defaultProject =
		pending !== undefined
			? pending.projectShortCode ?? undefined
			: user?.defaultProjectShortCode

	// the same for the order: what was just saved shows before the user data reloads
	const pendingOrder = (
		orderFetcher.json as { projectShortCodes?: string[] } | undefined
	)?.projectShortCodes
	const savedOrder = pendingOrder ?? user?.projectOrder ?? []
	const savedProjects = orderProjects(projects, savedOrder)
	const shownProjects = orderProjects(
		projects,
		dragOrder ?? droppedOrder ?? savedOrder
	)
	const shortCodes = shownProjects.map((project) => project.projectShortCode)
	const isTitleOrder = savedOrder.length === 0

	// once the save of the dropped order is under way, it shows from there
	useEffect(() => {
		if (pendingOrder) setDroppedOrder(null)
	}, [pendingOrder])

	const toggleDefault = (project: Project) => {
		const isDefault = defaultProject === project.projectShortCode
		fetcher.submit(
			{
				intent: 'defaultProject',
				projectShortCode: isDefault ? null : project.projectShortCode,
			},
			{
				method: 'post',
				action: Route.preferences,
				encType: 'application/json',
			}
		)
	}

	const saveOrder = (order: string[]) => {
		orderFetcher.submit(
			{ intent: 'projectOrder', projectShortCodes: order },
			{
				method: 'post',
				action: Route.preferences,
				encType: 'application/json',
			}
		)
	}

	// with the arrows, for keyboards and screen readers
	const moveBy = (index: number, step: number) => {
		const to = index + step
		if (to < 0 || to >= shownProjects.length) return
		saveOrder(moveItem(shortCodes, index, to))
		setMovedMessage(
			`${shownProjects[index].title} moved to position ${to + 1} of ${
				shownProjects.length
			}`
		)
	}

	// with a mouse or a finger, from the grip of a project
	const startDrag = (event: React.PointerEvent<HTMLElement>, code: string) => {
		event.preventDefault()
		event.currentTarget.setPointerCapture(event.pointerId)
		setDraggingCode(code)
		setDragOrder(shortCodes)
	}
	const dragTo = (event: React.PointerEvent<HTMLElement>) => {
		if (!draggingCode || !dragOrder) return
		// near the top or bottom of a long list, it scrolls to keep going
		const area = list.current?.getBoundingClientRect()
		if (area && list.current) {
			if (event.clientY < area.top + 32) list.current.scrollBy(0, -16)
			else if (event.clientY > area.bottom - 32) list.current.scrollBy(0, 16)
		}
		// the project goes before the first one whose middle is below the pointer
		const target = dragOrder.findIndex((code) => {
			const box = rows.current.get(code)?.getBoundingClientRect()
			return box !== undefined && event.clientY < box.top + box.height / 2
		})
		const to = target === -1 ? dragOrder.length - 1 : target
		setDragOrder(moveItem(dragOrder, dragOrder.indexOf(draggingCode), to))
	}
	const endDrag = (save: boolean) => {
		// dropped where it was: nothing to save
		const savedCodes = savedProjects.map((project) => project.projectShortCode)
		if (save && dragOrder && dragOrder.join() !== savedCodes.join()) {
			setDroppedOrder(dragOrder)
			saveOrder(dragOrder)
		}
		setDraggingCode(null)
		setDragOrder(null)
	}

	return (
		<aside
			className={`w-64 shrink-0 flex-col border-r border-gray-200 bg-white ${className}`}
		>
			<div className="flex items-center justify-between px-4 pb-2 pt-4">
				<h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
					Projects
				</h2>
				<div className="flex items-center gap-3">
					{projects.length > 1 && (
						<button
							type="button"
							onClick={() => setIsReordering(!isReordering)}
							aria-pressed={isReordering}
							className="text-xs font-medium text-brand-600 hover:text-brand-800"
						>
							{isReordering ? 'Done' : 'Reorder'}
						</button>
					)}
					{isAdmin && (
						<Link
							to={Route.newProject}
							className="text-xs font-medium text-brand-600 hover:text-brand-800"
						>
							+ New
						</Link>
					)}
					{canHide && !isReordering && (
						<button
							type="button"
							id="hide-project-list"
							onClick={() => {
								setProjectListHidden(true)
								document.getElementById('show-project-list')?.focus()
							}}
							aria-label="Hide project list"
							aria-expanded="true"
							title="Hide project list"
							className="-mr-1 rounded p-0.5 text-gray-500 hover:bg-gray-100 hover:text-gray-800"
						>
							<svg
								className="h-4 w-4"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
								strokeWidth="2"
								aria-hidden="true"
							>
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									d="M15 19l-7-7 7-7"
								/>
							</svg>
						</button>
					)}
				</div>
			</div>
			{isReordering && (
				<div className="flex items-center justify-between gap-2 px-4 pb-2 text-xs text-gray-500">
					<span>Drag, or use the arrows</span>
					<button
						type="button"
						onClick={() => {
							saveOrder([])
							setMovedMessage('Projects back in title order')
						}}
						disabled={isTitleOrder}
						className="shrink-0 font-medium text-brand-600 hover:text-brand-800 disabled:text-gray-400 disabled:hover:text-gray-400"
					>
						Reset to A-Z
					</button>
				</div>
			)}
			<nav
				ref={list}
				className="relative flex-1 space-y-0.5 overflow-auto px-2 pb-4"
			>
				{shownProjects.map((project, index) => {
					const isCurrent =
						project.projectShortCode === currentProject?.projectShortCode
					const isDefault = project.projectShortCode === defaultProject
					const label = (
						<>
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
						</>
					)
					if (isReordering) {
						const isDragging = draggingCode === project.projectShortCode
						return (
							<div
								key={project.projectID}
								ref={(element) => {
									if (element)
										rows.current.set(project.projectShortCode, element)
									else rows.current.delete(project.projectShortCode)
								}}
								className={`flex items-center rounded-md ${
									isDragging
										? 'bg-brand-50 shadow ring-1 ring-brand-300'
										: isCurrent
										? 'bg-brand-50'
										: 'hover:bg-gray-50'
								}`}
							>
								<button
									type="button"
									aria-label={`Drag ${project.title} to move it`}
									title="Drag to move"
									onPointerDown={(event) =>
										startDrag(event, project.projectShortCode)
									}
									onPointerMove={dragTo}
									onPointerUp={() => endDrag(true)}
									onPointerCancel={() => endDrag(false)}
									className="ml-1 shrink-0 cursor-grab touch-none select-none rounded px-2 py-3 text-base leading-none text-gray-400 hover:text-gray-600 active:cursor-grabbing"
								>
									<span aria-hidden="true">⠿</span>
								</button>
								<div className="min-w-0 flex-1 px-2 py-2">{label}</div>
								<button
									type="button"
									onClick={() => moveBy(index, -1)}
									disabled={index === 0}
									aria-label={`Move ${project.title} up`}
									className="rounded p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-800 disabled:opacity-30 disabled:hover:bg-transparent"
								>
									<span aria-hidden="true">↑</span>
								</button>
								<button
									type="button"
									onClick={() => moveBy(index, 1)}
									disabled={index === shownProjects.length - 1}
									aria-label={`Move ${project.title} down`}
									className="mr-1 rounded p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-800 disabled:opacity-30 disabled:hover:bg-transparent"
								>
									<span aria-hidden="true">↓</span>
								</button>
							</div>
						)
					}
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
								{label}
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
				<p role="status" className="sr-only">
					{movedMessage}
				</p>
			</nav>
		</aside>
	)
}
