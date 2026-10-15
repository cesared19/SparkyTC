import {
	type ActionFunctionArgs,
	type LoaderFunctionArgs,
	type MetaFunction,
	redirect,
} from '@remix-run/node'
import {
	Form,
	useActionData,
	useNavigation,
	useSearchParams,
} from '@remix-run/react'
import { ErrorMessage } from '~/components/ErrorMessage'
import { FetchResponse, User } from '~/models/types'
import { APIClient, UnauthorizedError } from '~/utility/APIClient'
import { APIRoute } from '~/utility/Routes'
import {
	createUserSession,
	getSessionToken,
	safeRedirect,
} from '~/utility/Session.server'

export const meta: MetaFunction = () => [{ title: 'Sign in - Cherry' }]

export async function loader({ request }: LoaderFunctionArgs) {
	if (await getSessionToken(request)) {
		return redirect('/')
	}
	return null
}

export async function action({ request }: ActionFunctionArgs) {
	const formData = await request.formData()
	const username = String(formData.get('username') ?? '')
	const password = String(formData.get('password') ?? '')

	if (!username || !password) {
		return { message: 'Enter your username and password' }
	}

	try {
		const response = await APIClient.post<
			FetchResponse<{ token: string; user: User }>
		>(APIRoute.login, { body: { username, password } })
		return createUserSession(
			response.data.token,
			safeRedirect(formData.get('redirectTo'))
		)
	} catch (error) {
		if (error instanceof UnauthorizedError) {
			return { message: 'Invalid username or password' }
		}
		return {
			message: error instanceof Error ? error.message : 'Unable to sign in',
		}
	}
}

export default function Login() {
	const actionData = useActionData<typeof action>()
	const navigation = useNavigation()
	const [searchParams] = useSearchParams()
	const isSubmitting = navigation.state !== 'idle'

	const inputClassName =
		'mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500'

	return (
		<div className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
			<div className="w-full max-w-sm space-y-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
				<div className="text-center">
					<h1 className="text-2xl font-semibold text-gray-900">Cherry</h1>
					<p className="mt-1 text-sm text-gray-500">Sign in to continue</p>
				</div>

				{actionData?.message && <ErrorMessage message={actionData.message} />}

				<Form method="post" className="space-y-4">
					<input
						type="hidden"
						name="redirectTo"
						value={searchParams.get('redirectTo') ?? '/'}
					/>
					<div>
						<label
							htmlFor="username"
							className="block text-sm font-medium text-gray-700"
						>
							Username
						</label>
						<input
							id="username"
							name="username"
							type="text"
							autoComplete="username"
							required
							// eslint-disable-next-line jsx-a11y/no-autofocus
							autoFocus
							className={inputClassName}
						/>
					</div>
					<div>
						<label
							htmlFor="password"
							className="block text-sm font-medium text-gray-700"
						>
							Password
						</label>
						<input
							id="password"
							name="password"
							type="password"
							autoComplete="current-password"
							required
							className={inputClassName}
						/>
					</div>
					<button
						type="submit"
						disabled={isSubmitting}
						className="w-full rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50"
					>
						{isSubmitting ? 'Signing in...' : 'Sign in'}
					</button>
				</Form>
			</div>
		</div>
	)
}
