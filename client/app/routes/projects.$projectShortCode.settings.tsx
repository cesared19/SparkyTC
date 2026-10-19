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
import { useEffect, useState } from 'react'
import { BuildManager } from '~/components/Builds'
import { ErrorMessage } from '~/components/ErrorMessage'
import { ProjectShell } from '~/components/ProjectShell'
import { Project } from '~/models/project'
import {
	FetchResponse,
	JiraConfiguration,
	JiraFailureMode,
	JiraIssueType,
	JiraSpace,
	ProjectBuild,
} from '~/models/types'
import { requireAdmin } from '~/utility/Authorization.server'
import { APIRoute, Route } from '~/utility/Routes'
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

	// the spaces and issue types are listed from Jira, falling back to typing them
	let spaces: JiraSpace[] | null = null
	let spacesError: string | undefined
	let issueTypes: JiraIssueType[] | null = null
	let canModifyReporter: boolean | null = null
	if (jira.data.isEnabled) {
		try {
			spaces = (await api.get<FetchResponse<JiraSpace[]>>(APIRoute.jiraSpaces))
				.data
		} catch (error) {
			spacesError = Tools.mapErrorToResponse(error).message
		}
		const spaceKey = project.jiraProjectKey ?? jira.data.projectKey
		if (spaces && spaceKey) {
			try {
				issueTypes = (
					await api.get<FetchResponse<JiraIssueType[]>>(
						APIRoute.jiraIssueTypes(spaceKey)
					)
				).data
			} catch {
				issueTypes = null
			}
			canModifyReporter = await reporterPermission(api, spaceKey)
		}
	}

	return {
		projects: projects.data,
		project,
		jira: jira.data,
		builds: builds.data,
		spaces,
		spacesError,
		issueTypes,
		canModifyReporter,
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
				jiraIssueType:
					String(formData.get('jiraIssueType') ?? '').trim() || null,
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
	const {
		projects,
		project,
		jira,
		builds,
		spaces,
		spacesError,
		issueTypes,
		canModifyReporter,
	} = useLoaderData<typeof loader>()
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

				<JiraTargetFields
					key={`${project.jiraProjectKey}-${project.jiraIssueType}`}
					project={project}
					jira={jira}
					spaces={spaces}
					spacesError={spacesError}
					initialIssueTypes={issueTypes}
					initialCanModifyReporter={canModifyReporter}
				/>

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

const selectClassName =
	'mt-1 block w-full max-w-md rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:opacity-60'

/**
 * The Jira space and issue type bugs from this project are created in, picked from lists when
 * Jira can be reached, or typed when it can't.
 */
function JiraTargetFields({
	project,
	jira,
	spaces,
	spacesError,
	initialIssueTypes,
	initialCanModifyReporter,
}: {
	project: Project
	jira: JiraConfiguration
	spaces: JiraSpace[] | null
	spacesError?: string
	initialIssueTypes: JiraIssueType[] | null
	initialCanModifyReporter: boolean | null
}) {
	const [spaceKey, setSpaceKey] = useState(project.jiraProjectKey ?? '')
	const [issueType, setIssueType] = useState(project.jiraIssueType ?? '')
	const typesFetcher = useFetcher<{
		issueTypes: JiraIssueType[]
		canModifyReporter: boolean | null
		message?: string
	}>()
	const isLoadingTypes = typesFetcher.state !== 'idle'
	const issueTypes = typesFetcher.data
		? typesFetcher.data.issueTypes
		: initialIssueTypes
	const issueTypesError = typesFetcher.data?.message
	const canModifyReporter = typesFetcher.data
		? typesFetcher.data.canModifyReporter
		: initialCanModifyReporter

	// keep the issue type only if the newly picked space has it
	useEffect(() => {
		const loaded = typesFetcher.data?.issueTypes
		if (loaded && !loaded.some((type) => type.name === issueType)) {
			setIssueType('')
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [typesFetcher.data])

	const pickSpace = (key: string) => {
		setSpaceKey(key)
		const target = key || jira.projectKey
		if (target) typesFetcher.load(Route.jiraIssueTypes(target))
	}

	const defaultSpace = spaces?.find((space) => space.key === jira.projectKey)
	const savedSpaceMissing =
		spaces && spaceKey && !spaces.some((space) => space.key === spaceKey)
	const savedTypeMissing =
		issueTypes && issueType && !issueTypes.some((t) => t.name === issueType)

	return (
		<>
			{spacesError && (
				<p className="rounded-md bg-yellow-50 p-3 text-sm text-yellow-800">
					Couldn&apos;t list the Jira spaces, type the key instead.{' '}
					{spacesError}
				</p>
			)}

			<div>
				<label
					htmlFor="jiraProjectKey"
					className="block text-sm font-medium text-gray-900"
				>
					Jira space
				</label>
				{spaces ? (
					<select
						id="jiraProjectKey"
						name="jiraProjectKey"
						value={spaceKey}
						onChange={(event) => pickSpace(event.target.value)}
						className={selectClassName}
					>
						<option value="">
							Default:{' '}
							{defaultSpace
								? `${defaultSpace.name} (${defaultSpace.key})`
								: jira.projectKey}
						</option>
						{savedSpaceMissing && (
							<option value={spaceKey}>{spaceKey} (not found in Jira)</option>
						)}
						{spaces.map((space) => (
							<option key={space.key} value={space.key}>
								{space.name} ({space.key})
							</option>
						))}
					</select>
				) : (
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
				)}
				<p className="mt-1 text-xs text-gray-500">
					Space (Jira project) issues from this project are created in. The
					default is set with JIRA_PROJECT_KEY ({jira.projectKey ?? 'not set'}
					).
				</p>
				{spaces && canModifyReporter === true && (
					<p className="mt-1 text-xs text-green-700">
						✓ Bugs are reported in the name of each user&apos;s linked Jira
						user.
					</p>
				)}
				{spaces && canModifyReporter === false && (
					<p className="mt-1 rounded-md bg-yellow-50 p-2 text-xs text-yellow-800">
						The shared Jira account doesn&apos;t have the Modify Reporter
						permission in this space, so bugs are reported as the shared
						account. Grant it in the space&apos;s permissions in Jira.
					</p>
				)}
			</div>

			<div>
				<label
					htmlFor="jiraIssueType"
					className="block text-sm font-medium text-gray-900"
				>
					Issue type
				</label>
				{spaces && issueTypes ? (
					<select
						id="jiraIssueType"
						name="jiraIssueType"
						value={issueType}
						disabled={isLoadingTypes}
						onChange={(event) => setIssueType(event.target.value)}
						className={selectClassName}
					>
						<option value="">
							Default: {jira.issueType}
							{issueTypes.some((type) => type.name === jira.issueType)
								? ''
								: ' (not available in this space)'}
						</option>
						{savedTypeMissing && (
							<option value={issueType}>
								{issueType} (not available in this space)
							</option>
						)}
						{issueTypes.map((type) => (
							<option key={type.id} value={type.name}>
								{type.name}
							</option>
						))}
					</select>
				) : (
					<input
						id="jiraIssueType"
						name="jiraIssueType"
						defaultValue={project.jiraIssueType ?? ''}
						placeholder={jira.issueType ?? 'Bug'}
						className="mt-1 block w-48 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
					/>
				)}
				{issueTypesError && (
					<p className="mt-1 text-xs text-red-600">{issueTypesError}</p>
				)}
				<p className="mt-1 text-xs text-gray-500">
					Type of the issues created for failures. The default is set with
					JIRA_ISSUE_TYPE ({jira.issueType ?? 'not set'}) and must exist in the
					chosen space.
				</p>
			</div>
		</>
	)
}

/** Whether the shared Jira account can report issues in other users' names, null when unknown. */
async function reporterPermission(
	api: Awaited<ReturnType<typeof requireAdmin>>['api'],
	spaceKey: string
) {
	try {
		const response = await api.get<
			FetchResponse<{ canModifyReporter: boolean }>
		>(APIRoute.jiraReporterPermission(spaceKey))
		return response.data.canModifyReporter
	} catch {
		return null
	}
}
