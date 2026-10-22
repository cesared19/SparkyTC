import { TestCase, TestCaseSection, TestPlan } from '~/models/types'
import { sectionAndDescendants } from '~/utility/Sections'

/** Why a test case is in a plan: its section, one of its labels, or chosen one by one. */
export type PlanReason = 'section' | 'label' | 'chosen'

/**
 * The test cases of a plan right now: those in its sections or the sections nested in them, those with any of
 * its labels, and the ones chosen one by one. Archived test cases aren't in the project's list, so they're out.
 */
export function planTestCases(
	plan: Pick<TestPlan, 'sectionIDs' | 'labels' | 'testCaseIDs'>,
	testCases: TestCase[],
	sections: TestCaseSection[]
): { testCase: TestCase; reasons: PlanReason[] }[] {
	const sectionIDs = new Set(
		plan.sectionIDs.flatMap((sectionID) => [
			...sectionAndDescendants(sections, sectionID),
		])
	)
	const labels = new Set(plan.labels.map((label) => label.toLowerCase()))
	const chosen = new Set(plan.testCaseIDs)

	return testCases.flatMap((testCase) => {
		const reasons: PlanReason[] = []
		if (testCase.sectionID && sectionIDs.has(testCase.sectionID)) {
			reasons.push('section')
		}
		if (testCase.labels?.some((label) => labels.has(label.toLowerCase()))) {
			reasons.push('label')
		}
		if (chosen.has(testCase.testCaseID)) reasons.push('chosen')
		return reasons.length > 0 ? [{ testCase, reasons }] : []
	})
}
