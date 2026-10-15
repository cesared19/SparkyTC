import {
	type ActionFunctionArgs,
	type LoaderFunctionArgs,
} from '@remix-run/node'
import {
	Form,
	useActionData,
	useFetcher,
	useLoaderData,
	useNavigation,
} from '@remix-run/react'
import { useEffect, useRef, useState } from 'react'
import { DateDisplay } from '~/components/DateDisplay'
import { ErrorMessage } from '~/components/ErrorMessage'
import { ErrorResponse, FetchResponse, User, UserRole } from '~/models/types'
import { Project } from '~/models/project'
import { requireAdmin } from '~/utility/Authorization.server'
import { useCurrentUser } from '~/utility/CurrentUser'
import { APIRoute } from '~/utility/Routes'
import { Tools } from '~/utility/Tools'

export async function loader({ request }: LoaderFunctionArgs) {
	const { api } = await requireAdmin(request)
	const [users, projects] = await Promise.all([
		api.get<FetchResponse<User[]>>(APIRoute.users),
		api.get<FetchResponse<Project[]>>(APIRoute.projects),
	])
	return { users: users.data, projects: projects.data }
}

export async function action({ request }: ActionFunctionArgs) {
	const { api } = await requireAdmin(request)
	try {
		const formData = await request.formData()
		const intent = formData.get('intent')
		const field = (name: string) => String(formData.get(name) ?? '').trim()

		if (intent === 'create') {
			await api.post(APIRoute.users, {
				body: {
					username: field('username'),
					displayName: field('displayName'),
					role: field('role'),
					password: String(formData.get('password') ?? ''),
				},
			})
		} else if (intent === 'projects') {
			await api.put(APIRoute.userProjects(field('userID')), {
				body: { projectIDs: formData.getAll('projectIDs').map(String) },
			})
		} else if (intent === 'update') {
			await api.put(APIRoute.user(field('userID')), {
				body: {
					displayName: field('displayName'),
					role: field('role'),
					isActive: formData.get('isActive') === 'on',
					password: String(formData.get('password') ?? '') || null,
				},
			})
		} else {
			throw 'Invalid request'
		}
		return { ok: true as const, intent }
	} catch (error) {
		return Tools.mapErrorToResponse(error)
	}
}

const inputClassName =
	'block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500'

function RoleSelect({
	defaultValue,
	id,
}: {
	defaultValue?: UserRole
	id?: string
}) {
	return (
		<select
			id={id}
			name="role"
			defaultValue={defaultValue ?? UserRole.tester}
			className={inputClassName}
		>
			<option value={UserRole.tester}>Tester</option>
			<option value={UserRole.admin}>Admin</option>
		</select>
	)
}

export default function Users() {
	const { users, projects } = useLoaderData<typeof loader>()
	const actionData = useActionData<typeof action>()
	const navigation = useNavigation()
	const createFormRef = useRef<HTMLFormElement>(null)
	const created =
		actionData && 'ok' in actionData && actionData.intent === 'create'

	useEffect(() => {
		if (created) createFormRef.current?.reset()
	}, [created])

	return (
		<main className="flex-1 overflow-auto p-6">
			<div className="space-y-8">
				<div>
					<h2 className="text-2xl font-semibold text-gray-900">Users</h2>
					<p className="mt-1 text-sm text-gray-600">
						Testers can create, import and run test cases and report bugs to
						Jira in the projects assigned to them. Admins see every project and
						can also create projects, manage users and properties, and delete
						test cases and test runs.
					</p>
				</div>

				<div className="overflow-x-auto rounded-md border border-gray-200">
					<table className="min-w-full divide-y divide-gray-200 text-sm">
						<thead className="bg-gray-50">
							<tr>
								{[
									'Username',
									'Display name',
									'Role',
									'Projects',
									'Active',
									'Reset password',
									'Created',
									'',
								].map((header) => (
									<th
										key={header}
										className="px-3 py-2 text-left font-medium text-gray-500"
									>
										{header}
									</th>
								))}
							</tr>
						</thead>
						<tbody className="divide-y divide-gray-200 bg-white">
							{users.map((user) => (
								<UserRow key={user.userID} user={user} projects={projects} />
							))}
						</tbody>
					</table>
				</div>

				<Form ref={createFormRef} method="post" className="max-w-xl space-y-4">
					<h3 className="text-lg font-medium text-gray-900">New user</h3>
					{actionData && 'message' in actionData && (
						<ErrorMessage message={actionData.message} />
					)}
					{created && (
						<p className="rounded-md bg-green-50 p-3 text-sm text-green-800">
							User created. Share the password with them so they can sign in and
							change it from their account page.
						</p>
					)}
					<input type="hidden" name="intent" value="create" />
					<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
						<div>
							<label
								htmlFor="new-username"
								className="block text-sm font-medium text-gray-700"
							>
								Username
							</label>
							<input
								id="new-username"
								name="username"
								required
								autoComplete="off"
								className={`mt-1 ${inputClassName}`}
							/>
						</div>
						<div>
							<label
								htmlFor="new-displayName"
								className="block text-sm font-medium text-gray-700"
							>
								Display name
							</label>
							<input
								id="new-displayName"
								name="displayName"
								required
								className={`mt-1 ${inputClassName}`}
							/>
						</div>
						<div>
							<label
								htmlFor="new-role"
								className="block text-sm font-medium text-gray-700"
							>
								Role
							</label>
							<div className="mt-1">
								<RoleSelect id="new-role" />
							</div>
						</div>
						<div>
							<label
								htmlFor="new-password"
								className="block text-sm font-medium text-gray-700"
							>
								Initial password (at least 8 characters)
							</label>
							<input
								id="new-password"
								name="password"
								type="password"
								required
								minLength={8}
								autoComplete="new-password"
								className={`mt-1 ${inputClassName}`}
							/>
						</div>
					</div>
					<button
						type="submit"
						disabled={navigation.state !== 'idle'}
						className="rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50"
					>
						Create user
					</button>
				</Form>
			</div>
		</main>
	)
}

function UserProjects({ user, projects }: { user: User; projects: Project[] }) {
	const fetcher = useFetcher<ErrorResponse | { ok: true }>()
	const detailsRef = useRef<HTMLDetailsElement>(null)
	const assigned = new Set(user.projectIDs ?? [])

	useEffect(() => {
		if (fetcher.state === 'idle' && fetcher.data && 'ok' in fetcher.data) {
			detailsRef.current?.removeAttribute('open')
		}
	}, [fetcher.state, fetcher.data])

	if (user.role === UserRole.admin) {
		return <span className="text-xs text-gray-500">All projects</span>
	}

	return (
		<details ref={detailsRef}>
			<summary className="cursor-pointer whitespace-nowrap text-xs font-medium text-sky-600 hover:text-sky-800">
				{assigned.size === 0
					? 'No projects'
					: `${assigned.size} project${assigned.size === 1 ? '' : 's'}`}
			</summary>
			<fetcher.Form
				method="post"
				className="mt-2 w-60 space-y-2 rounded-md border border-gray-200 bg-white p-3"
			>
				<input type="hidden" name="intent" value="projects" />
				<input type="hidden" name="userID" value={user.userID} />
				<p className="text-xs text-gray-500">
					Projects {user.displayName} can see
				</p>
				<div className="max-h-56 space-y-1 overflow-auto">
					{projects.map((project) => (
						<label
							key={project.projectID}
							className="flex items-center gap-2 text-sm text-gray-700"
						>
							<input
								type="checkbox"
								name="projectIDs"
								value={project.projectID}
								defaultChecked={assigned.has(project.projectID)}
								className="h-4 w-4 rounded border-gray-300 text-sky-600 focus:ring-sky-500"
							/>
							<span className="truncate">
								{project.title}{' '}
								<span className="text-gray-500">
									({project.projectShortCode})
								</span>
							</span>
						</label>
					))}
					{projects.length === 0 && (
						<p className="text-sm text-gray-500">No projects yet</p>
					)}
				</div>
				{fetcher.data && 'message' in fetcher.data && (
					<p className="text-xs text-red-600">{fetcher.data.message}</p>
				)}
				<button
					type="submit"
					disabled={fetcher.state !== 'idle'}
					className="rounded-md bg-sky-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-sky-700 disabled:opacity-50"
				>
					{fetcher.state !== 'idle' ? 'Saving...' : 'Save'}
				</button>
			</fetcher.Form>
		</details>
	)
}

function UserRow({ user, projects }: { user: User; projects: Project[] }) {
	const fetcher = useFetcher<ErrorResponse | { ok: true }>()
	const currentUser = useCurrentUser()
	const [isDirty, setIsDirty] = useState(false)
	const error =
		fetcher.data && 'message' in fetcher.data ? fetcher.data.message : undefined
	const formID = `user-${user.userID}`

	useEffect(() => {
		if (fetcher.state === 'idle' && fetcher.data && 'ok' in fetcher.data) {
			setIsDirty(false)
		}
	}, [fetcher.state, fetcher.data])

	return (
		<tr className={user.isActive ? undefined : 'bg-gray-50 text-gray-400'}>
			<td className="px-3 py-2 font-medium">
				{user.username}
				{user.userID === currentUser?.userID && (
					<span className="ml-2 text-xs text-gray-500">(you)</span>
				)}
				<fetcher.Form
					id={formID}
					method="post"
					onChange={() => setIsDirty(true)}
				>
					<input type="hidden" name="intent" value="update" />
					<input type="hidden" name="userID" value={user.userID} />
				</fetcher.Form>
				{error && <p className="mt-1 text-xs text-red-600">{error}</p>}
			</td>
			<td className="px-3 py-2">
				<input
					form={formID}
					name="displayName"
					defaultValue={user.displayName}
					aria-label={`Display name for ${user.username}`}
					onChange={() => setIsDirty(true)}
					className={inputClassName}
				/>
			</td>
			<td className="px-3 py-2">
				<select
					form={formID}
					name="role"
					defaultValue={user.role}
					aria-label={`Role for ${user.username}`}
					onChange={() => setIsDirty(true)}
					className={inputClassName}
				>
					<option value={UserRole.tester}>Tester</option>
					<option value={UserRole.admin}>Admin</option>
				</select>
			</td>
			<td className="px-3 py-2 align-top">
				<UserProjects user={user} projects={projects} />
			</td>
			<td className="px-3 py-2">
				<input
					form={formID}
					type="checkbox"
					name="isActive"
					defaultChecked={user.isActive}
					aria-label={`${user.username} is active`}
					onChange={() => setIsDirty(true)}
					className="h-4 w-4 rounded border-gray-300 text-sky-600 focus:ring-sky-500"
				/>
			</td>
			<td className="px-3 py-2">
				<input
					form={formID}
					type="password"
					name="password"
					placeholder="New password"
					autoComplete="new-password"
					aria-label={`New password for ${user.username}`}
					onChange={() => setIsDirty(true)}
					className={inputClassName}
				/>
			</td>
			<td className="px-3 py-2 whitespace-nowrap">
				<DateDisplay date={user.creationDate} />
			</td>
			<td className="px-3 py-2">
				<button
					type="submit"
					form={formID}
					disabled={!isDirty || fetcher.state !== 'idle'}
					className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40"
				>
					{fetcher.state !== 'idle' ? 'Saving...' : 'Save'}
				</button>
			</td>
		</tr>
	)
}
