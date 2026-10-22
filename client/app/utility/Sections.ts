import { TestCase, TestCaseSection } from '~/models/types'

export interface SectionNode {
	section: TestCaseSection
	depth: number
	children: SectionNode[]
}

/** Suites and their sections as a tree, each level in its order. */
export function sectionTree(sections: TestCaseSection[]): SectionNode[] {
	const build = (parentID: string | undefined, depth: number): SectionNode[] =>
		sections
			.filter((section) => (section.parentID ?? undefined) === parentID)
			.sort((a, b) => a.position - b.position)
			.map((section) => ({
				section,
				depth,
				children: build(section.sectionID, depth + 1),
			}))
	return build(undefined, 0)
}

/** The tree flattened in display order, e.g. for an indented dropdown. */
export function flattenTree(nodes: SectionNode[]): SectionNode[] {
	return nodes.flatMap((node) => [node, ...flattenTree(node.children)])
}

/** e.g. "Mobile / Login / SSO" */
export function sectionPath(sections: TestCaseSection[], sectionID?: string) {
	const names: string[] = []
	let current = sections.find((section) => section.sectionID === sectionID)
	while (current) {
		names.unshift(current.name)
		const parentID: string | undefined = current.parentID
		current = sections.find((section) => section.sectionID === parentID)
	}
	return names.join(' / ')
}

/** The section and every section nested in it. */
export function sectionAndDescendants(
	sections: TestCaseSection[],
	sectionID: string
): Set<string> {
	const ids = new Set([sectionID])
	let added = true
	while (added) {
		added = false
		for (const section of sections) {
			if (
				section.parentID &&
				ids.has(section.parentID) &&
				!ids.has(section.sectionID)
			) {
				ids.add(section.sectionID)
				added = true
			}
		}
	}
	return ids
}

/** Test cases grouped by section, in tree order, leaving out sections without any. */
export function groupBySection(
	sections: TestCaseSection[],
	testCases: TestCase[]
): { section?: TestCaseSection; testCases: TestCase[] }[] {
	const ordered = flattenTree(sectionTree(sections)).map((node) => node.section)
	const groups = ordered
		.map((section) => ({
			section,
			testCases: testCases.filter(
				(testCase) => testCase.sectionID === section.sectionID
			),
		}))
		.filter((group) => group.testCases.length > 0)
	const known = new Set(ordered.map((section) => section.sectionID))
	const unfiled = testCases.filter(
		(testCase) => !testCase.sectionID || !known.has(testCase.sectionID)
	)
	return unfiled.length > 0 ? [...groups, { testCases: unfiled }] : groups
}
