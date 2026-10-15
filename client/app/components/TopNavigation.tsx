import { Form, Link } from '@remix-run/react'
import { User, UserRole } from '~/models/types'
import { Route } from '~/utility/Routes'

interface TopNavigationProps {
	user: User
}

export default function TopNavigation({ user }: TopNavigationProps) {
	const isAdmin = user.role === UserRole.admin
	const linkClassName = 'text-sm font-medium text-gray-700 hover:text-sky-600'

	return (
		<div className="border-b border-gray-200 bg-white">
			<div className="flex h-14 items-center justify-between px-4">
				<div className="flex items-center">
					<h1 className="text-xl font-semibold text-gray-900">Cherry</h1>
					<nav className="ml-8 flex space-x-4">
						<Link to="/" className={linkClassName}>
							Projects
						</Link>
						{isAdmin && (
							<>
								<Link to={Route.viewProperties} className={linkClassName}>
									Configuration
								</Link>
								<Link to={Route.users} className={linkClassName}>
									Users
								</Link>
							</>
						)}
					</nav>
				</div>
				<div className="flex items-center gap-4 text-sm">
					<Link
						to={Route.account}
						className="text-gray-700 hover:text-sky-600"
						title="Account settings"
					>
						{user.displayName}
						<span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
							{isAdmin ? 'Admin' : 'Tester'}
						</span>
					</Link>
					<Form method="post" action={Route.logout}>
						<button type="submit" className="text-gray-600 hover:text-gray-900">
							Sign out
						</button>
					</Form>
				</div>
			</div>
		</div>
	)
}
