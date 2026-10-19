import {
	type ActionFunctionArgs,
	type LoaderFunctionArgs,
} from '@remix-run/node'
import {
	Form,
	useActionData,
	useLoaderData,
	useNavigation,
} from '@remix-run/react'
import { useState } from 'react'
import { BuildManager } from '~/components/Builds'
import { ErrorMessage } from '~/components/ErrorMessage'
import { ProjectShell } from '~/components/ProjectShell'
import { Project } from '~/models/project'
import {
	FetchResponse,
	JiraConfiguration,
	JiraFailureMode,
	ProjectBuild,
} from '~/models/types'
import { requireAdmin } from '~/utility/Authorization.server'
import { APIRoute } from '~/utility/Routes'
import { Tools } from '~/utility/Tools'

export async function loader({ request, params }: LoaderFunctionArgs) {
	const { api } = await requireAdmin(request)
	const projectShortCode = params.projectShortCode ?? ''
	const [projects, jira] = await Promise.all([
		api.get<FetchResponse<Project[]>>(APIRoute.projects),
		api.get<FetchResponse<JiraConfiguration>>(APIRoute.jiraConfiguration),
	])
	const project = projects.data.find(
		(p) => p.projectShortCode === params.projectShortCode
	)
	if (!project) {
		throw new Response('Project not found', { status: 404 })
	}
	const builds = await api.get<FetchResponse<ProjectBuild[]>>(
		APIRoute.projectBuilds(projectShortCode)
	)
	return {
		projects: projects.data,
		project,
		jira: jira.data,
		builds: builds.data,
	}
}

export async function action({ request, params }: ActionFunctionArgs) {
	const { api } = await requireAdmin(request)
	try {
		const formData = await request.formData()
		await api.put(APIRoute.projectSettings(params.projectShortCode ?? ''), {
			body: {
				jiraFailureMode: formData.get('jiraFailureMode'),
				jiraProjectKey:
					String(formData.get('jiraProjectKey') ?? '').trim() || null,
			},
		})
		return { ok: true as const }
	} catch (error) {
		return Tools.mapErrorToResponse(error)
	}
}

const MODES = [
	{
		value: JiraFailureMode.disabled,
		label: 'Disabled',
		description:
			'Failures never create Jira issues. Existing issues can still be linked.',
	},
	{
		value: JiraFailureMode.manual,
		label: 'Manual',
		description:
			'Testers create the issue from a failed test case with a pre-filled form they can review.',
	},
	{
		value: JiraFailureMode.automatic,
		label: 'Automatic',
		description:
			'Saving a failed result creates the issue right away, filled from the test case and the run notes. Missing details are sent as "Not provided".',
	},
]

export default function ProjectSettings() {
	const { projects, project, jira, builds } = useLoaderData<typeof loader>()
	const actionData = useActionData<typeof action>()
	const navigation = useNavigation()
	const [mode, setMode] = useState(project.jiraFailureMode)

	return (
		<ProjectShell projects={projects} currentProject={project}>
			<Form method="post" className="max-w-2xl space-y-6">
				<div>
					<h2 className="text-lg font-semibold text-gray-900">Jira</h2>
					{!jira.isEnabled && (
						<p className="mt-1 text-sm text-gray-500">
							The Jira integration isn&apos;t configured on the server yet.
							These settings apply once JIRA_BASE_URL, JIRA_EMAIL and
							JIRA_API_TOKEN are set.
						</p>
					)}
				</div>

				{actionData && 'message' in actionData && (
					<ErrorMessage message={actionData.message} />
				)}
				{actionData && 'ok' in actionData && navigation.state === 'idle' && (
					<p className="rounded-md bg-green-50 p-3 text-sm text-green-800">
						Settings saved
					</p>
				)}

				<fieldset className="space-y-3">
					<legend className="text-sm font-medium text-gray-900">
						When a test case fails during a test run
					</legend>
					{MODES.map((option) => (
						// the label text is nested one level deeper than the rule checks
						// eslint-disable-next-line jsx-a11y/label-has-associated-control
						<label
							key={option.value}
							className={`flex cursor-pointer gap-3 rounded-md border p-3 ${
								mode === option.value
									? 'border-brand-600 bg-brand-50'
									: 'border-gray-200 hover:bg-gray-50'
							}`}
						>
							<input
								type="radio"
								name="jiraFailureMode"
								value={option.value}
								checked={mode === option.value}
								onChange={() => setMode(option.value)}
								className="mt-1 h-4 w-4 border-gray-300 text-brand-600 focus:ring-brand-500"
							/>
							<span>
								<span className="block text-sm font-medium text-gray-900">
									{option.label}
								</span>
								<span className="block text-sm text-gray-600">
									{option.description}
								</span>
							</span>
						</label>
					))}
				</fieldset>

				<div>
					<label
						htmlFor="jiraProjectKey"
						className="block text-sm font-medium text-gray-900"
					>
						Jira project
					</label>
					<input
						id="jiraProjectKey"
						name="jiraProjectKey"
						defaultValue={project.jiraProjectKey ?? ''}
						placeholder={jira.projectKey ?? 'SCRUM'}
						onInput={(event) => {
							event.currentTarget.value =
								event.currentTarget.value.toUpperCase()
						}}
						className="mt-1 block w-48 rounded-md border border-gray-300 px-3 py-2 text-sm uppercase focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
					/>
					<p className="mt-1 text-xs text-gray-500">
						Key of the Jira project issues from this project are created in.
						Leave it empty to use the default (
						{jira.projectKey ?? 'JIRA_PROJECT_KEY'}).
					</p>
				</div>

				<button
					type="submit"
					disabled={navigation.state !== 'idle'}
					className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
				>
					{navigation.state !== 'idle' ? 'Saving...' : 'Save settings'}
				</button>
			</Form>

			<section id="builds" className="mt-10 max-w-2xl space-y-3">
				<div>
					<h2 className="text-lg font-semibold text-gray-900">Builds</h2>
					<p className="mt-1 text-sm text-gray-500">
						Builds testers pick from when running tests. The current build is
						shown on the dashboard and sent with Jira issues.
					</p>
				</div>
				<BuildManager
					projectShortCode={project.projectShortCode}
					builds={builds}
				/>
			</section>
		</ProjectShell>
	)
}
