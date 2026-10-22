import { Project } from '~/models/project'
import {
	PropertyConfiguration,
	SharedStep,
	StepInput,
	TestCase,
	TestCaseFormat,
	TestCaseRun,
	TestCaseRunStatus,
	TestCaseSection,
	TestCaseStep,
	TestRun,
} from '~/models/types'
import { toCSV } from '~/utility/CSV'
import { sectionPath } from '~/utility/Sections'
import { Tools } from '~/utility/Tools'
import { buildXlsx } from '~/utility/Xlsx'

export type ExportFormat = 'csv' | 'xlsx'

// a shared step in the Steps column, e.g. "2. [Shared] Sign in"
const SHARED_PREFIX = '[Shared] '
const EXPECTED_PREFIX = 'Expected:'

/**
 * Steps as numbered text that the import reads back:
 * "1. Open the page" then "   Expected: It loads"; shared steps are "2. [Shared] Sign in".
 */
export function stepsToText(steps: TestCaseStep[]) {
	return steps
		.map((step, index) => {
			if (step.sharedStep) {
				return `${index + 1}. ${SHARED_PREFIX}${step.sharedStep.name}`
			}
			const lines = [`${index + 1}. ${indentLines(step.action ?? '')}`]
			if (step.expected) {
				lines.push(`   ${EXPECTED_PREFIX} ${indentLines(step.expected)}`)
			}
			return lines.join('\n')
		})
		.join('\n')
}

// continuation lines are indented so they aren't read as a new step
function indentLines(text: string) {
	return text.trim().split('\n').join('\n   ')
}

/** Reads numbered steps back; undefined when the text isn't numbered steps. */
export function parseStepsText(
	text: string,
	sharedSteps: SharedStep[]
): { steps: StepInput[]; errors: string[] } | undefined {
	const steps: { action: string; expected?: string; shared?: string }[] = []
	let field: 'action' | 'expected' = 'action'
	for (const rawLine of text.split(/\r?\n/)) {
		const line = rawLine.trim()
		// only unindented lines start a step; indented ones continue the one before
		const numbered = /^\d+[.)]\s+(.*)$/.exec(rawLine.trimEnd())
		if (numbered) {
			const content = numbered[1].trim()
			steps.push(
				content.startsWith(SHARED_PREFIX)
					? { action: '', shared: content.slice(SHARED_PREFIX.length).trim() }
					: { action: content }
			)
			field = 'action'
		} else if (steps.length === 0) {
			// text before the first numbered line means these aren't steps
			if (line) return undefined
		} else if (line.startsWith(EXPECTED_PREFIX)) {
			steps[steps.length - 1].expected = line
				.slice(EXPECTED_PREFIX.length)
				.trim()
			field = 'expected'
		} else if (line) {
			const step = steps[steps.length - 1]
			step[field] = `${step[field] ?? ''}\n${line}`
		}
	}
	if (steps.length === 0) return undefined

	const errors: string[] = []
	const inputs = steps.map((step): StepInput => {
		if (step.shared === undefined) {
			return { action: step.action, expected: step.expected }
		}
		const shared = sharedSteps.find(
			(candidate) => candidate.name.toLowerCase() === step.shared?.toLowerCase()
		)
		if (!shared) errors.push(`Unknown shared step "${step.shared}"`)
		return { sharedStepID: shared?.sharedStepID }
	})
	return { steps: inputs, errors }
}

/** Test cases with the columns the CSV import reads, so the file can be edited and imported again. */
export function testCaseRows(
	project: Project,
	testCases: TestCase[],
	properties: PropertyConfiguration[],
	sections: TestCaseSection[]
): string[][] {
	const header = [
		'ID',
		'Title',
		'Section',
		'Labels',
		'Description',
		'Format',
		'Test Instructions',
		'Steps',
		...properties.map((property) => property.title),
	]
	const rows = testCases.map((testCase) => [
		Tools.testCaseDisplayCode(project, testCase),
		testCase.title,
		sectionPath(sections, testCase.sectionID),
		(testCase.labels ?? []).join(', '),
		testCase.description ?? '',
		testCase.format === TestCaseFormat.steps ? 'Steps' : 'Text',
		testCase.testInstructions ?? '',
		testCase.format === TestCaseFormat.steps
			? stepsToText(testCase.steps ?? [])
			: '',
		...properties.map(
			(property) =>
				testCase.propertyValues[property.propertyConfigurationID] ?? ''
		),
	])
	return [header, ...rows]
}

const STATUS_NAMES: Record<TestCaseRunStatus, string> = {
	[TestCaseRunStatus.pending]: 'Pending',
	[TestCaseRunStatus.pass]: 'Pass',
	[TestCaseRunStatus.fail]: 'Fail',
	[TestCaseRunStatus.blocked]: 'Blocked',
	[TestCaseRunStatus.skip]: 'Skip',
}

/** The results of a test run: each test case with its current result, for a report or a spreadsheet. */
export function runResultRows(
	project: Project,
	testRun: TestRun,
	testCaseRuns: TestCaseRun[],
	sections: TestCaseSection[]
): (string | number)[][] {
	const header = [
		'ID',
		'Title',
		'Section',
		'Status',
		'Comment',
		'Recorded by',
		'Recorded at',
		'Results recorded',
		...(testRun.trackTime ? ['Time (minutes)'] : []),
		'Jira issues',
		'Build',
	]
	const rows = testCaseRuns.map((run) => [
		Tools.testCaseDisplayCode(project, run.testCase),
		run.title,
		sectionPath(sections, run.testCase.sectionID),
		STATUS_NAMES[run.status],
		run.notes ?? '',
		run.status === TestCaseRunStatus.pending ? '' : run.executedBy ?? '',
		run.executedAt ? new Date(run.executedAt).toLocaleString('en-US') : '',
		run.results.length,
		...(testRun.trackTime ? [Math.round(run.timeSeconds / 6) / 10] : []),
		(run.testCase.jiraLinks ?? []).map((link) => link.issueKey).join(', '),
		testRun.build?.buildNumber ?? '',
	])
	return [header, ...rows]
}

/** Downloads rows as a .csv (UTF-8, readable by Excel) or an .xlsx file. */
export async function downloadTable(
	fileName: string,
	sheetName: string,
	rows: (string | number)[][],
	format: ExportFormat
) {
	// the byte order mark makes Excel read the CSV as UTF-8
	const csv = () =>
		new Blob(
			['\uFEFF' + toCSV(rows.map((row) => row.map((cell) => String(cell))))],
			{ type: 'text/csv;charset=utf-8' }
		)
	const blob = format === 'xlsx' ? await buildXlsx(sheetName, rows) : csv()
	const url = URL.createObjectURL(blob)
	const link = document.createElement('a')
	link.href = url
	link.download = `${fileName}.${format}`
	document.body.appendChild(link)
	link.click()
	link.remove()
	setTimeout(() => URL.revokeObjectURL(url), 1000)
}
