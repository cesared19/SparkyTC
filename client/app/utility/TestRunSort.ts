import { TestRun, TestRunStatus } from '~/models/types'

export type TestRunSort = 'open' | 'newest' | 'oldest' | 'title' | 'build'

export const TEST_RUN_SORTS: { value: TestRunSort; label: string }[] = [
	{ value: 'open', label: 'Open first' },
	{ value: 'newest', label: 'Newest first' },
	{ value: 'oldest', label: 'Oldest first' },
	{ value: 'title', label: 'Title (A–Z)' },
	{ value: 'build', label: 'Build (newest first)' },
]

export const DEFAULT_TEST_RUN_SORT: TestRunSort = 'open'

// how the runs were created: in the app (manual) or through the integration API (automated)
export type TestRunKind = 'all' | 'manual' | 'automated'

export const TEST_RUN_KINDS: { value: TestRunKind; label: string }[] = [
	{ value: 'all', label: 'All' },
	{ value: 'manual', label: 'Manual' },
	{ value: 'automated', label: 'Automated' },
]

export const DEFAULT_TEST_RUN_KIND: TestRunKind = 'all'

export function isTestRunKind(value: string | null): value is TestRunKind {
	return TEST_RUN_KINDS.some((kind) => kind.value === value)
}

export function filterTestRuns(testRuns: TestRun[], kind: TestRunKind) {
	if (kind === 'all') return testRuns
	return testRuns.filter(
		(testRun) => testRun.automated === (kind === 'automated')
	)
}

export function isTestRunSort(value: string | null): value is TestRunSort {
	return TEST_RUN_SORTS.some((sort) => sort.value === value)
}

// runs being worked on come first, then the ones not started, then the finished ones
const STATUS_ORDER: Record<TestRunStatus, number> = {
	[TestRunStatus.inProgress]: 0,
	[TestRunStatus.pending]: 1,
	[TestRunStatus.complete]: 2,
	[TestRunStatus.abort]: 3,
}

const newestFirst = (a: TestRun, b: TestRun) =>
	b.testRunNumber - a.testRunNumber

/** A sorted copy of the test runs; ties keep the newest run first. */
export function sortTestRuns(testRuns: TestRun[], sort: TestRunSort) {
	const compare: Record<TestRunSort, (a: TestRun, b: TestRun) => number> = {
		open: (a, b) =>
			STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || newestFirst(a, b),
		newest: newestFirst,
		oldest: (a, b) => a.testRunNumber - b.testRunNumber,
		title: (a, b) =>
			a.title.localeCompare(b.title, undefined, {
				sensitivity: 'base',
				numeric: true,
			}) || newestFirst(a, b),
		// builds registered later come first, runs without a build last
		build: (a, b) =>
			(b.build?.creationDate ?? -Infinity) -
				(a.build?.creationDate ?? -Infinity) || newestFirst(a, b),
	}
	return [...testRuns].sort(compare[sort])
}
