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
import { FetchResponse, JiraConfiguration, UserTheme } from '~/models/types'
import { useEffect, useRef } from 'react'
import { ErrorMessage } from '~/components/ErrorMessage'
import { JiraUserPicker } from '~/components/JiraUserPicker'
import { requireAPI } from '~/utility/API.server'
import { useCurrentUser } from '~/utility/CurrentUser'
import { APIRoute, Route } from '~/utility/Routes'
import { Tools } from '~/utility/Tools'

export async function loader({ request }: LoaderFunctionArgs) {
	const api = await requireAPI(request)
	const jira = await api.get<FetchResponse<JiraConfiguration>>(
		APIRoute.jiraConfiguration
	)
	return { jira: jira.data }
}

export async function action({ request }: ActionFunctionArgs) {
	const api = await requireAPI(request)
	try {
		const formData = await request.formData()
		const currentPassword = String(formData.get('currentPassword') ?? '')
		const newPassword = String(formData.get('newPassword') ?? '')
		if (newPassword !== formData.get('confirmPassword')) {
			throw 'The new passwords do not match'
		}

		await api.put(APIRoute.changePassword, {
			body: { currentPassword, newPassword },
		})
		return { ok: true as const }
	} catch (error) {
		return Tools.mapErrorToResponse(error)
	}
}

export default function Account() {
	const user = useCurrentUser()
	const { jira } = useLoaderData<typeof loader>()
	const actionData = useActionData<typeof action>()
	const navigation = useNavigation()
	const formRef = useRef<HTMLFormElement>(null)
	const succeeded = actionData && 'ok' in actionData

	useEffect(() => {
		if (succeeded) formRef.current?.reset()
	}, [succeeded])

	const inputClassName =
		'mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500'

	return (
		<main className="flex-1 overflow-auto p-6">
			<div className="max-w-md space-y-6">
				<div>
					<h2 className="text-2xl font-semibold text-gray-900">Account</h2>
					<p className="mt-1 text-sm text-gray-600">
						Signed in as <b>{user?.username}</b> ({user?.displayName})
					</p>
				</div>

				<ThemeSelector />

				<NotificationPreferences />

				{jira.isEnabled && user && (
					<section className="space-y-3">
						<h3 className="text-lg font-medium text-gray-900">Jira user</h3>
						<p className="text-sm text-gray-600">
							The Jira bugs you create from SparkyTC are reported in the name of
							this Jira user.
						</p>
						<JiraUserPicker key={user.jiraAccountID ?? 'none'} user={user} />
					</section>
				)}

				<Form ref={formRef} method="post" className="space-y-4">
					<h3 className="text-lg font-medium text-gray-900">Change password</h3>
					{actionData && 'message' in actionData && (
						<ErrorMessage message={actionData.message} />
					)}
					{succeeded && (
						<p className="rounded-md bg-green-50 p-3 text-sm text-green-800">
							Your password was changed
						</p>
					)}
					{[
						{
							name: 'currentPassword',
							label: 'Current password',
							autoComplete: 'current-password',
						},
						{
							name: 'newPassword',
							label: 'New password (at least 8 characters)',
							autoComplete: 'new-password',
						},
						{
							name: 'confirmPassword',
							label: 'Confirm new password',
							autoComplete: 'new-password',
						},
					].map((field) => (
						<div key={field.name}>
							<label
								htmlFor={field.name}
								className="block text-sm font-medium text-gray-700"
							>
								{field.label}
							</label>
							<input
								id={field.name}
								name={field.name}
								type="password"
								required
								autoComplete={field.autoComplete}
								className={inputClassName}
							/>
						</div>
					))}
					<button
						type="submit"
						disabled={navigation.state !== 'idle'}
						className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
					>
						Change password
					</button>
				</Form>
			</div>
		</main>
	)
}

const THEME_OPTIONS = [
	{ value: UserTheme.light, label: 'Light' },
	{ value: UserTheme.dark, label: 'Dark' },
	{ value: UserTheme.system, label: 'Same as system' },
]

function ThemeSelector() {
	const user = useCurrentUser()
	const fetcher = useFetcher()
	// show the pending choice right away, the page re-themes once the preference is saved
	const pendingTheme = (fetcher.json as { theme?: UserTheme } | undefined)
		?.theme
	const selected = pendingTheme ?? user?.theme ?? UserTheme.system

	return (
		<fieldset className="space-y-3">
			<legend className="text-lg font-medium text-gray-900">Appearance</legend>
			<div className="flex flex-wrap gap-2">
				{THEME_OPTIONS.map((option) => (
					<label
						key={option.value}
						className={`cursor-pointer rounded-md border px-4 py-2 text-sm font-medium ${
							selected === option.value
								? 'border-brand-500 bg-brand-50 text-brand-600'
								: 'border-gray-300 text-gray-700 hover:bg-gray-50'
						}`}
					>
						<input
							type="radio"
							name="theme"
							value={option.value}
							checked={selected === option.value}
							onChange={() =>
								fetcher.submit(
									{ intent: 'theme', theme: option.value },
									{
										method: 'post',
										action: Route.preferences,
										encType: 'application/json',
									}
								)
							}
							className="sr-only"
						/>
						{option.label}
					</label>
				))}
			</div>
		</fieldset>
	)
}

function NotificationPreferences() {
	const user = useCurrentUser()
	const fetcher = useFetcher()
	const pending = fetcher.json as
		| { testRunAssigned: boolean; testRunCompleted: boolean }
		| undefined
	const preferences = pending ?? {
		testRunAssigned: user?.notifyTestRunAssigned ?? true,
		testRunCompleted: user?.notifyTestRunCompleted ?? true,
	}

	const update = (change: Partial<typeof preferences>) =>
		fetcher.submit(
			{ intent: 'notifications', ...preferences, ...change },
			{ method: 'post', action: Route.preferences, encType: 'application/json' }
		)

	const options = [
		{
			key: 'testRunAssigned' as const,
			label: 'I am assigned to a test run',
		},
		{
			key: 'testRunCompleted' as const,
			label: 'A test run in one of my projects is completed',
		},
	]

	return (
		<fieldset className="space-y-3">
			<legend className="text-lg font-medium text-gray-900">
				Notifications
			</legend>
			<p className="text-sm text-gray-600">Notify me in SparkyTC when:</p>
			{options.map((option) => (
				<label
					key={option.key}
					className="flex items-center gap-2 text-sm text-gray-700"
				>
					<input
						type="checkbox"
						checked={preferences[option.key]}
						onChange={(event) => update({ [option.key]: event.target.checked })}
						className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
					/>
					{option.label}
				</label>
			))}
		</fieldset>
	)
}
