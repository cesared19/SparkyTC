import {
	CreateTestCase,
	PropertyConfiguration,
	PropertyType,
	SharedStep,
	TestCaseFormat,
} from '~/models/types'
import { parseCSV, toCSV } from './CSV'
import { parseStepsText } from './TestCaseExport'

export const TITLE_COLUMN = 'Title'
export const DESCRIPTION_COLUMN = 'Description'
export const TEST_INSTRUCTIONS_COLUMN = 'Test Instructions'
// several labels in one cell, separated by commas or semicolons
export const LABELS_COLUMN = 'Labels'
// a path such as "Mobile / Login", created when it doesn't exist
export const SECTION_COLUMN = 'Section'
export const FORMAT_COLUMN = 'Format'
// numbered steps, as exported: "1. Open the page" and "   Expected: It loads"
export const STEPS_COLUMN = 'Steps'
// exported files have it; the import gives new numbers
const ID_COLUMN = 'ID'

const COLUMN_ALIASES: Record<string, string[]> = {
	[TITLE_COLUMN]: ['title', 'name', 'titulo', 'título', 'nombre'],
	[DESCRIPTION_COLUMN]: ['description', 'descripcion', 'descripción'],
	[TEST_INSTRUCTIONS_COLUMN]: [
		'test instructions',
		'instructions',
		'instrucciones',
	],
	[STEPS_COLUMN]: ['steps', 'test steps', 'pasos'],
	[SECTION_COLUMN]: [
		'section',
		'seccion',
		'sección',
		'suite',
		'folder',
		'carpeta',
	],
	[FORMAT_COLUMN]: ['format', 'formato'],
	[ID_COLUMN]: ['id'],
	[LABELS_COLUMN]: ['labels', 'label', 'tags', 'etiquetas'],
}

export interface ImportedTestCaseRow {
	rowNumber: number
	testCase: CreateTestCase
	errors: string[]
}

export interface TestCaseImportResult {
	rows: ImportedTestCaseRow[]
	ignoredColumns: string[]
	errors: string[]
}

const normalize = (value: string) => value.trim().toLowerCase()

function resolveSelectOption(
	property: PropertyConfiguration,
	value: string
): string | undefined {
	return property.selectOptions?.find(
		(option) => normalize(option) === normalize(value)
	)
}

/**
 * Converts the contents of a CSV file into test cases. The header row is matched against the
 * built-in columns and against the configured property titles (case insensitive).
 */
export function importTestCasesFromCSV(
	text: string,
	properties: PropertyConfiguration[],
	sharedSteps: SharedStep[] = []
): TestCaseImportResult {
	const [header, ...dataRows] = parseCSV(text)
	if (!header) {
		return { rows: [], ignoredColumns: [], errors: ['The file is empty'] }
	}

	const columnIndexes = new Map<string, number>()
	const propertyIndexes = new Map<PropertyConfiguration, number>()
	const ignoredColumns: string[] = []

	header.forEach((rawColumn, index) => {
		const column = normalize(rawColumn)
		if (column === '') return

		const builtInColumn = Object.entries(COLUMN_ALIASES).find(([, aliases]) =>
			aliases.includes(column)
		)?.[0]
		const property = properties.find((p) => normalize(p.title) === column)

		if (builtInColumn && !columnIndexes.has(builtInColumn)) {
			columnIndexes.set(builtInColumn, index)
		} else if (property && !propertyIndexes.has(property)) {
			propertyIndexes.set(property, index)
		} else {
			ignoredColumns.push(rawColumn.trim())
		}
	})

	if (!columnIndexes.has(TITLE_COLUMN)) {
		return {
			rows: [],
			ignoredColumns,
			errors: [`The file must have a "${TITLE_COLUMN}" column`],
		}
	}

	const cell = (row: string[], index?: number) =>
		index === undefined ? '' : (row[index] ?? '').trim()
	const labelsOf = (row: string[]) =>
		cell(row, columnIndexes.get(LABELS_COLUMN))
			.split(/[,;]/)
			.map((label) => label.trim())
			.filter(Boolean)

	const rows = dataRows.map((row, index): ImportedTestCaseRow => {
		const errors: string[] = []
		const title = cell(row, columnIndexes.get(TITLE_COLUMN))
		if (!title) {
			errors.push('Missing title')
		}

		const propertyValues: Record<string, string> = {}
		for (const property of properties) {
			const rawValue = cell(row, propertyIndexes.get(property))
			const id = property.propertyConfigurationID

			if (!rawValue) {
				if (property.isRequired && property.defaultValue) {
					propertyValues[id] = property.defaultValue
				} else if (property.isRequired) {
					errors.push(`Missing value for ${property.title}`)
				}
				continue
			}

			switch (property.propertyType) {
				case PropertyType.singleSelectList: {
					const option = resolveSelectOption(property, rawValue)
					if (option) {
						propertyValues[id] = option
					} else {
						errors.push(
							`"${rawValue}" is not a valid option for ${property.title} (${(
								property.selectOptions ?? []
							).join(', ')})`
						)
					}
					break
				}
				case PropertyType.number:
					if (Number.isNaN(Number(rawValue))) {
						errors.push(`${property.title} must be a number`)
					} else {
						propertyValues[id] = rawValue
					}
					break
				default:
					propertyValues[id] = rawValue
			}
		}

		const steps = readSteps(
			cell(row, columnIndexes.get(STEPS_COLUMN)),
			cell(row, columnIndexes.get(FORMAT_COLUMN)),
			sharedSteps
		)
		errors.push(...steps.errors)
		const sectionPath = cell(row, columnIndexes.get(SECTION_COLUMN))

		return {
			// header is row 1 in the spreadsheet
			rowNumber: index + 2,
			testCase: {
				title,
				description: cell(row, columnIndexes.get(DESCRIPTION_COLUMN)),
				testInstructions:
					cell(row, columnIndexes.get(TEST_INSTRUCTIONS_COLUMN)) ||
					(steps.instructions ?? ''),
				propertyValues,
				...(steps.format ? { format: steps.format, steps: steps.steps } : {}),
				...(sectionPath ? { sectionPath } : {}),
				...(columnIndexes.has(LABELS_COLUMN) ? { labels: labelsOf(row) } : {}),
			},
			errors,
		}
	})

	return {
		rows,
		ignoredColumns,
		errors: rows.length === 0 ? ['The file has no test cases'] : [],
	}
}

/**
 * The Steps and Format columns of a row. Without a Format column, numbered steps make a test case written as
 * steps; any other text in a Steps column is read as instructions, as files from before steps did.
 */
function readSteps(text: string, format: string, sharedSteps: SharedStep[]) {
	const wantsSteps = format
		? ['steps', 'pasos'].includes(format.toLowerCase())
		: !!text
	if (!wantsSteps) return { errors: [] as string[] }
	const parsed = parseStepsText(text, sharedSteps)
	if (parsed) {
		return {
			format: TestCaseFormat.steps,
			steps: parsed.steps,
			errors: parsed.errors,
		}
	}
	if (format) {
		return {
			errors: [
				'The Steps column must have numbered steps, e.g. "1. Open the page"',
			],
		}
	}
	return { instructions: text, errors: [] as string[] }
}

export function buildTestCaseTemplateCSV(properties: PropertyConfiguration[]) {
	const header = [
		TITLE_COLUMN,
		DESCRIPTION_COLUMN,
		TEST_INSTRUCTIONS_COLUMN,
		LABELS_COLUMN,
		...properties.map((property) => property.title),
	]
	const example = [
		'Login with valid credentials',
		'Verify users can sign in. Spec: https://example.com/login-spec',
		'1. Open https://example.com/login\n2. Enter valid credentials\n3. Click Login\n4. Verify the dashboard is displayed',
		'smoke, login',
		...properties.map(
			(property) => property.defaultValue ?? property.selectOptions?.[0] ?? ''
		),
	]
	return toCSV([header, example])
}
