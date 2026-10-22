import { useParams, Outlet, useOutletContext } from '@remix-run/react'
import {
	ProjectTestCasesOutletContext,
	PropertyValue,
	TestCaseOutletContext,
} from '~/models/types'
import { Tools } from '~/utility/Tools'
import { projectLabels } from '~/components/LabelInput'

export default function TestCaseDetailsRoot() {
	// hooks before any early return, so they run in the same order on every render
	const params = useParams()
	const { project, testCases, properties, sections, sharedSteps } =
		useOutletContext<ProjectTestCasesOutletContext>()
	const testCaseNumber = Number(params.testCaseNumber)
	if (!testCaseNumber) {
		return <p>No test case number found</p>
	}

	const testCase = testCases.find(
		(testCase) => testCase.testCaseNumber === testCaseNumber
	)
	if (!testCase) {
		return <p>Test case not found</p>
	}

	const propertyValues: PropertyValue[] = Tools.mapTestCaseProperties(
		testCase,
		properties
	)

	const context: TestCaseOutletContext = {
		project,
		testCase,
		properties,
		propertyValues,
		sections,
		labels: projectLabels(testCases),
		sharedSteps,
	}

	return <Outlet context={context} />
}
