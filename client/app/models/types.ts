import { Project } from './project'

export interface TestCase {
	testCaseID: string
	projectID: string
	creationDate: number
	testCaseNumber: number
	title: string
	description?: string
	testInstructions?: string
	propertyValues: Record<string, string>
	attachments?: TestCaseAttachment[]
	jiraLinks?: JiraLink[]
}

export interface JiraLink {
	linkID: string
	creationDate: number
	issueKey: string
	issueURL: string
}

export interface JiraIssue {
	issueKey: string
	issueURL: string
	summary?: string
	status?: string
	statusCategory?: 'new' | 'indeterminate' | 'done' | string
	error?: string
}

export interface JiraConfiguration {
	isEnabled: boolean
	baseURL?: string
	projectKey?: string
	issueType?: string
}

export interface CreateJiraIssue extends Record<string, any> {
	summary: string
	stepsToReproduce: string
	expectedResult: string
	actualResult: string
	buildNumber: string
}

export interface TestCaseAttachment {
	attachmentID: string
	creationDate: number
	fileName: string
	contentType: string
	fileSize: number
}

export interface CreateTestCase extends Record<string, any> {
	title: string
	description: string
	testInstructions: string
	propertyValues: Record<string, string>
}

export interface PropertyValue {
	propertyConfiguration: PropertyConfiguration
	value?: string
}

export enum PropertyType {
	text = 'TEXT',
	number = 'NUMBER',
	singleSelectList = 'SINGLE_SELECT_LIST',
}

export enum PropertyConfigurationSource {
	system = 'SYSTEM',
	customer = 'CUSTOMER',
}

export interface PropertyConfiguration {
	propertyConfigurationID: string
	creationDate: number
	source: PropertyConfigurationSource
	title: string
	propertyType: PropertyType
	isRequired: boolean
	defaultValue?: string
	selectOptions?: string[]
}

export interface EnumConfiguration {
	options: string[]
	defaultValue?: string
}

export interface PropertyConfigurationResponse {
	data: PropertyConfiguration[]
}

export interface FetchResponse<T> {
	data: T
}

export interface UpdateRequestBody<T> extends Record<string, any> {
	id: string
	data: T
}

export enum TestRunStatus {
	pending = 'PENDING',
	inProgress = 'IN_PROGRESS',
	abort = 'ABORT',
	complete = 'COMPLETE',
}

export interface TestRun {
	testRunID: string
	creationDate: number
	testRunNumber: number
	status: TestRunStatus
	title: string
	description?: string
}

export enum TestCaseRunStatus {
	pending = 'PENDING',
	pass = 'PASS',
	fail = 'FAIL',
	skip = 'SKIP',
}

export interface TestCaseRun {
	testCaseRunID: string
	creationDate: number
	testCase: TestCase
	status: TestCaseRunStatus
	title: string
	description?: string
	testInstructions?: string
	notes?: string
}

export interface UpdateTestCaseRunDetails extends Record<string, any> {
	title: string
	description?: string
	testInstructions?: string
	applyToTestCase: boolean
}

export interface UpdateTestRun extends Record<string, any> {
	title: string
	description?: string
	status: TestRunStatus
}

export interface ProjectTestCasesOutletContext {
	project: Project
	testCases: TestCase[]
	properties: PropertyConfiguration[]
}

export interface TestCaseOutletContext {
	project: Project
	testCase: TestCase
	properties: PropertyConfiguration[]
	propertyValues: PropertyValue[]
}

export interface ProjectTestRunsOutletContext {
	project: Project
	testRuns: TestRun[]
}

export interface ProjectTestCaseRunsOutletContext {
	project: Project
	testRun: TestRun
	testCaseRuns: TestCaseRun[]
	properties: PropertyConfiguration[]
}

export interface ErrorResponse extends Record<string, any> {
	message: string
}

export interface PropertyConfigurationOutletContext {
	properties: PropertyConfiguration[]
}

export interface PropertyConfigurationDetailsOutletContext {
	property: PropertyConfiguration
}
