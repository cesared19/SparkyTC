import { type LoaderFunctionArgs } from '@remix-run/node'
import {
	isRouteErrorResponse,
	Links,
	Meta,
	Outlet,
	Scripts,
	ScrollRestoration,
	useLoaderData,
	useRouteError,
} from '@remix-run/react'
import TopNavigation from '~/components/TopNavigation'
import { requireUser } from '~/utility/Authorization.server'

import './tailwind.css'

export function Layout({ children }: { children: React.ReactNode }) {
	return (
		<html lang="en">
			<head>
				<meta charSet="utf-8" />
				<meta name="viewport" content="width=device-width, initial-scale=1" />
				<title>SparkyTC</title>
				<Meta />
				<Links />
			</head>
			<body>
				{children}
				<ScrollRestoration />
				<Scripts />
			</body>
		</html>
	)
}

export function links() {
	return [
		{ rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' },
		{
			rel: 'icon',
			type: 'image/png',
			sizes: '16x16',
			href: '/favicon-16x16.png',
		},
		{
			rel: 'icon',
			type: 'image/png',
			sizes: '32x32',
			href: '/favicon-32x32.png',
		},
		{ rel: 'apple-touch-icon', href: '/apple-touch-icon.png' },
	]
}

export async function loader({ request }: LoaderFunctionArgs) {
	// the login page is the only page available without a session
	if (new URL(request.url).pathname === '/login') {
		return { user: undefined }
	}
	const { user } = await requireUser(request)
	return { user }
}

export default function App() {
	const { user } = useLoaderData<typeof loader>()
	return (
		<div className="flex h-screen flex-col">
			{user && <TopNavigation user={user} />}
			<Outlet />
		</div>
	)
}

export function ErrorBoundary() {
	const error = useRouteError()
	const message = isRouteErrorResponse(error)
		? error.status === 403
			? 'You do not have permission to view this page.'
			: `${error.status} ${error.statusText || error.data}`
		: error instanceof Error
		? error.message
		: 'An unexpected error occurred'

	return (
		<div className="flex h-screen items-center justify-center p-6">
			<div className="max-w-md space-y-4 text-center">
				<h1 className="text-xl font-semibold text-gray-900">
					Something went wrong
				</h1>
				<p className="text-sm text-gray-600">{message}</p>
				<a href="/" className="text-sm text-sky-600 hover:underline">
					Go to projects
				</a>
			</div>
		</div>
	)
}
