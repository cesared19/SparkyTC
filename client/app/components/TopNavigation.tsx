import { Form, Link, useLocation } from '@remix-run/react'
import { useEffect, useState } from 'react'
import { User, UserRole } from '~/models/types'
import { Route } from '~/utility/Routes'
import { NotificationBell } from './NotificationBell'

interface TopNavigationProps {
	user: User
}

export default function TopNavigation({ user }: TopNavigationProps) {
	const isAdmin = user.role === UserRole.admin
	const location = useLocation()
	const [isMenuOpen, setIsMenuOpen] = useState(false)
	const linkClassName = 'text-sm font-medium text-gray-700 hover:text-brand-600'
	const roleLabel = user.isSuperAdmin
		? 'Super admin'
		: isAdmin
		? 'Admin'
		: 'Tester'
	const links = [
		{ to: '/', label: 'Projects' },
		...(isAdmin
			? [
					{ to: Route.viewProperties, label: 'Configuration' },
					{ to: Route.users, label: 'Users' },
			  ]
			: []),
	]

	// the phone menu closes once a link is followed
	useEffect(() => setIsMenuOpen(false), [location.pathname])

	return (
		<div className="relative border-b border-gray-200 bg-white">
			<div className="flex h-14 items-center justify-between px-4">
				<div className="flex items-center">
					<h1 className="text-xl font-semibold text-gray-900">
						Sparky<span className="text-brand-600">TC</span>
					</h1>
					<nav className="ml-8 hidden space-x-4 md:flex">
						{links.map((link) => (
							<Link key={link.to} to={link.to} className={linkClassName}>
								{link.label}
							</Link>
						))}
					</nav>
				</div>
				<div className="flex items-center gap-2 text-sm md:gap-4">
					<NotificationBell />
					<Link
						to={Route.account}
						className="hidden text-gray-700 hover:text-brand-600 md:inline"
						title="Account settings"
					>
						{user.displayName}
						<span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
							{roleLabel}
						</span>
					</Link>
					<Form method="post" action={Route.logout} className="hidden md:block">
						<button type="submit" className="text-gray-600 hover:text-gray-900">
							Sign out
						</button>
					</Form>
					<button
						type="button"
						onClick={() => setIsMenuOpen(!isMenuOpen)}
						aria-label="Menu"
						aria-expanded={isMenuOpen}
						className="rounded-md p-2 text-gray-600 hover:bg-gray-100 hover:text-gray-900 md:hidden"
					>
						<svg
							className="h-6 w-6"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
							strokeWidth="2"
							aria-hidden="true"
						>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								d={
									isMenuOpen
										? 'M6 18L18 6M6 6l12 12'
										: 'M4 6h16M4 12h16M4 18h16'
								}
							/>
						</svg>
					</button>
				</div>
			</div>

			{isMenuOpen && (
				<nav className="absolute inset-x-0 top-full z-30 border-b border-gray-200 bg-white px-4 pb-4 pt-2 shadow-lg md:hidden">
					{links.map((link) => (
						<Link
							key={link.to}
							to={link.to}
							className="block rounded-md px-3 py-3 text-base font-medium text-gray-700 hover:bg-gray-50"
						>
							{link.label}
						</Link>
					))}
					<div className="mt-2 border-t border-gray-200 pt-2">
						<Link
							to={Route.account}
							className="flex items-center justify-between rounded-md px-3 py-3 text-base text-gray-700 hover:bg-gray-50"
						>
							<span>
								{user.displayName}
								<span className="block text-xs text-gray-500">
									Account settings
								</span>
							</span>
							<span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
								{roleLabel}
							</span>
						</Link>
						<Form method="post" action={Route.logout}>
							<button
								type="submit"
								className="block w-full rounded-md px-3 py-3 text-left text-base text-gray-700 hover:bg-gray-50"
							>
								Sign out
							</button>
						</Form>
					</div>
				</nav>
			)}
		</div>
	)
}
