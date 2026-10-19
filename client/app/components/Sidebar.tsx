import { NavLink } from '@remix-run/react'

interface SidebarProps {
	title: string
	description?: string
	items: { to: string; label: string }[]
}

export default function ProjectSidebar({
	title,
	description,
	items,
}: SidebarProps) {
	return (
		<div className="border-b border-gray-200 bg-white md:w-64 md:shrink-0 md:border-b-0 md:border-r">
			<div className="px-4 pt-4 md:p-4">
				<h2 className="text-lg font-medium text-gray-900">{title}</h2>
				{description && (
					<p className="mt-1 text-sm text-gray-500 line-clamp-2">
						{description}
					</p>
				)}
			</div>
			<nav className="flex gap-1 overflow-x-auto p-2 md:block md:space-y-1">
				{items.map((item) => (
					<NavLink
						key={item.to}
						to={item.to}
						className={({ isActive }) =>
							`block shrink-0 rounded-md px-3 py-2 text-sm font-medium ${
								isActive
									? 'bg-brand-50 text-brand-600'
									: 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
							}`
						}
					>
						{item.label}
					</NavLink>
				))}
			</nav>
		</div>
	)
}
