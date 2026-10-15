import { type ActionFunctionArgs, redirect } from '@remix-run/node'
import {
	useActionData,
	useNavigate,
	useNavigation,
	useOutletContext,
	useSubmit,
} from '@remix-run/react'
import { useState } from 'react'
import { APIRoute, Route } from '~/utility/Routes'
import {
	CreateTestCase,
	ErrorResponse,
	ProjectTestCasesOutletContext,
} from '~/models/types'
import { requireAPI } from '~/utility/API.server'
import { Tools } from '~/utility/Tools'
import { ErrorMessage } from '~/components/ErrorMessage'
import { BackButton } from '~/components/BackButton'
import {
	buildTestCaseTemplateCSV,
	importTestCasesFromCSV,
	TestCaseImportResult,
} from '~/utility/TestCaseImport'

export async function action({ request, params }: ActionFunctionArgs) {
	const api = await requireAPI(request)
	try {
		const projectShortCode = params.projectShortCode
		if (!projectShortCode) {
			throw 'Project short code is required'
		}

		const { testCases } = (await request.json()) as {
			testCases: CreateTestCase[]
		}
		await api.post(APIRoute.batchCreateTestCases(projectShortCode), {
			body: { testCases },
		})
		return redirect(Route.viewProjectTestCases(projectShortCode))
	} catch (error) {
		return Response.json(Tools.mapErrorToResponse(error), { status: 400 })
	}
}

export default function ImportTestCases() {
	const { project, properties } =
		useOutletContext<ProjectTestCasesOutletContext>()
	const navigate = useNavigate()
	const navigation = useNavigation()
	const submit = useSubmit()
	const actionData = useActionData<ErrorResponse>()

	const [fileName, setFileName] = useState<string>()
	const [result, setResult] = useState<TestCaseImportResult>()

	const rowsWithErrors = result?.rows.filter((row) => row.errors.length > 0)
	const canImport =
		!!result &&
		result.errors.length === 0 &&
		result.rows.length > 0 &&
		rowsWithErrors?.length === 0
	const isSubmitting = navigation.state !== 'idle'

	const handleFileChange = async (
		event: React.ChangeEvent<HTMLInputElement>
	) => {
		const file = event.target.files?.[0]
		if (!file) {
			setFileName(undefined)
			setResult(undefined)
			return
		}

		setFileName(file.name)
		const text = await file.text()
		setResult(importTestCasesFromCSV(text, properties))
	}

	const handleDownloadTemplate = () => {
		const csv = buildTestCaseTemplateCSV(properties)
		// prepend a BOM so spreadsheet tools detect UTF-8 accents correctly
		const blob = new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' })
		const url = URL.createObjectURL(blob)
		const link = document.createElement('a')
		link.href = url
		link.download = `${project.projectShortCode}-test-cases-template.csv`
		link.click()
		URL.revokeObjectURL(url)
	}

	const handleImport = () => {
		if (!result || !canImport) return
		submit(
			{ testCases: result.rows.map((row) => row.testCase) },
			{ method: 'POST', encType: 'application/json' }
		)
	}

	return (
		<div className="space-y-6">
			<BackButton />

			<div>
				<h2 className="text-2xl font-semibold text-gray-900">
					Import Test Cases
				</h2>
				<p className="mt-2 text-sm text-gray-600">
					Upload a .csv file to create multiple test cases at once. The first
					row must contain the column names: <b>Title</b> (required),{' '}
					<b>Description</b>, <b>Test Instructions</b> and optionally one column
					per property (
					{properties.map((property) => property.title).join(', ')}). Empty
					required properties use their default value.
				</p>
			</div>

			{actionData && <ErrorMessage message={actionData.message} />}

			<div className="flex flex-wrap items-center gap-3">
				<label className="inline-flex cursor-pointer items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
					{fileName ? 'Choose a different file' : 'Choose CSV file'}
					<input
						type="file"
						accept=".csv,text/csv"
						className="sr-only"
						onChange={handleFileChange}
					/>
				</label>
				{fileName && <span className="text-sm text-gray-600">{fileName}</span>}
				<button
					type="button"
					onClick={handleDownloadTemplate}
					className="text-sm text-brand-600 hover:text-brand-800 hover:underline"
				>
					Download template
				</button>
			</div>

			{result && (
				<div className="space-y-4">
					{result.errors.map((error) => (
						<ErrorMessage key={error} message={error} />
					))}

					{result.ignoredColumns.length > 0 && (
						<p className="rounded-md bg-yellow-50 p-3 text-sm text-yellow-800">
							These columns do not match any field or property and will be
							ignored: {result.ignoredColumns.join(', ')}
						</p>
					)}

					{rowsWithErrors && rowsWithErrors.length > 0 && (
						<ErrorMessage
							message={`${rowsWithErrors.length} row(s) have errors. Fix them in the file and choose it again.`}
						/>
					)}

					{result.rows.length > 0 && (
						<div className="overflow-x-auto rounded-md border border-gray-200">
							<table className="min-w-full divide-y divide-gray-200 text-sm">
								<thead className="bg-gray-50">
									<tr>
										<th className="px-3 py-2 text-left font-medium text-gray-500">
											Row
										</th>
										<th className="px-3 py-2 text-left font-medium text-gray-500">
											Title
										</th>
										<th className="px-3 py-2 text-left font-medium text-gray-500">
											Description
										</th>
										{properties.map((property) => (
											<th
												key={property.propertyConfigurationID}
												className="px-3 py-2 text-left font-medium text-gray-500"
											>
												{property.title}
											</th>
										))}
										<th className="px-3 py-2 text-left font-medium text-gray-500">
											Status
										</th>
									</tr>
								</thead>
								<tbody className="divide-y divide-gray-200 bg-white">
									{result.rows.map((row) => (
										<tr
											key={row.rowNumber}
											className={
												row.errors.length > 0 ? 'bg-red-50' : undefined
											}
										>
											<td className="px-3 py-2 text-gray-500">
												{row.rowNumber}
											</td>
											<td className="px-3 py-2 text-gray-900">
												{row.testCase.title || '-'}
											</td>
											<td className="max-w-xs truncate px-3 py-2 text-gray-700">
												{row.testCase.description || '-'}
											</td>
											{properties.map((property) => (
												<td
													key={property.propertyConfigurationID}
													className="px-3 py-2 text-gray-700"
												>
													{row.testCase.propertyValues[
														property.propertyConfigurationID
													] || '-'}
												</td>
											))}
											<td className="px-3 py-2">
												{row.errors.length > 0 ? (
													<span className="text-red-700">
														{row.errors.join('; ')}
													</span>
												) : (
													<span className="text-green-700">Ready</span>
												)}
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					)}
				</div>
			)}

			<div className="flex justify-end space-x-3">
				<button
					type="button"
					onClick={() =>
						navigate(Route.viewProjectTestCases(project.projectShortCode))
					}
					className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
				>
					Cancel
				</button>
				<button
					type="button"
					onClick={handleImport}
					disabled={!canImport || isSubmitting}
					className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
				>
					{isSubmitting
						? 'Importing...'
						: `Import ${result?.rows.length ?? 0} test case(s)`}
				</button>
			</div>
		</div>
	)
}
