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
	createdBy?: string
	updatedBy?: string
	modifyDate?: number
	// deleted while used by test runs, which keep its results
	isArchived?: boolean
	// the suite or section it's filed in
	sectionID?: string
	// free labels such as smoke or payments
	labels?: string[]
	// free text instructions, or steps each with its expected result
	format?: TestCaseFormat
	steps?: TestCaseStep[]
}

export enum TestCaseFormat {
	text = 'TEXT',
	steps = 'STEPS',
}

// a step of a test case, or a shared step inserted as a block
export interface TestCaseStep {
	stepID: string
	action?: string
	expected?: string
	sharedStep?: SharedStep
}

// a step sent when saving a test case
export interface StepInput {
	action?: string
	expected?: string
	sharedStepID?: string
}

// steps reused by several test cases; editing them updates every test case that uses them
export interface SharedStep {
	sharedStepID: string
	name: string
	items: { action: string; expected?: string }[]
	usageCount: number
}

// a step as copied into a test run, with shared steps expanded
export interface TestCaseRunStep {
	stepID: string
	action: string
	expected?: string
	sharedStepName?: string
}

// how a step went in one result
export interface StepResult {
	stepID: string
	status?: TestCaseRunStatus
	actual?: string
}

// a folder of test cases; the ones without a parent are the project's suites
export interface TestCaseSection {
	sectionID: string
	parentID?: string
	name: string
	// order among its siblings
	position: number
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
	assigneeAccountID?: string
	assigneeName?: string
}

export interface JiraTransition {
	transitionID: string
	name: string
	toStatus?: string
	toStatusCategory?: string
}

// a linked issue to close on a pass or reopen on a fail
export interface JiraIssueTransition {
	issueKey: string
	transitionID: string
	assigneeAccountID?: string
}

export interface JiraConfiguration {
	isEnabled: boolean
	baseURL?: string
	projectKey?: string
	issueType?: string
}

// a Jira project, called a space in newer Jira Cloud sites
export interface JiraSpace {
	key: string
	name: string
}

export interface JiraIssueType {
	id: string
	name: string
}

export interface JiraUser {
	accountID: string
	displayName: string
	emailAddress?: string
	avatarURL?: string
}

export interface CreateJiraIssue extends Record<string, any> {
	summary: string
	stepsToReproduce: string
	expectedResult: string
	actualResult: string
	buildNumber: string
}

export enum UserRole {
	admin = 'ADMIN',
	tester = 'TESTER',
}

export interface UserSummary {
	userID: string
	displayName: string
}

export enum JiraFailureMode {
	disabled = 'DISABLED',
	manual = 'MANUAL',
	automatic = 'AUTOMATIC',
}

export enum NotificationType {
	testRunAssigned = 'TEST_RUN_ASSIGNED',
	testRunCompleted = 'TEST_RUN_COMPLETED',
	jiraIssueFailed = 'JIRA_ISSUE_FAILED',
	jiraReporterNotSet = 'JIRA_REPORTER_NOT_SET',
}

export interface AppNotification {
	notificationID: string
	creationDate: number
	type: NotificationType
	title: string
	message: string
	link?: string
	isRead: boolean
}

export interface NotificationList {
	unreadCount: number
	notifications: AppNotification[]
}

export interface SimilarJiraIssue {
	issueKey: string
	issueURL: string
	summary: string
	status?: string
	statusCategory?: string
	similarity: number
}

export enum UserTheme {
	light = 'LIGHT',
	dark = 'DARK',
	system = 'SYSTEM',
}

export interface User {
	userID: string
	creationDate: number
	username: string
	displayName: string
	role: UserRole
	isActive: boolean
	theme: UserTheme
	defaultProjectShortCode?: string
	projectIDs?: string[]
	notifyTestRunAssigned: boolean
	notifyTestRunCompleted: boolean
	isSuperAdmin: boolean
	// the Jira user this user's issues are reported as
	jiraAccountID?: string
	jiraDisplayName?: string
}

export interface TestRunSummary {
	testRunID: string
	testRunNumber: number
	title: string
	status: TestRunStatus
	creationDate: number
	createdBy?: string
	totalCount: number
	resultCounts: Record<TestCaseRunStatus, number>
}

export interface ProjectDashboard {
	project: Project
	testCaseCount: number
	propertyBreakdowns: {
		title: string
		counts: { value: string; count: number }[]
	}[]
	testRunCounts: Record<TestRunStatus, number>
	activeTestRuns: TestRunSummary[]
	recentTestRuns: TestRunSummary[]
	linkedJiraIssueCount: number
	currentBuild?: ProjectBuild
	currentBuildTimeline: BuildTimelinePoint[]
	currentBuildTimeSeconds?: number
}

// latest executed result of each test case on a build; rates are over pass, fail, skip and blocked
export interface BuildResultCounts {
	testCaseCount: number
	passed: number
	failed: number
	skipped: number
	blocked: number
	pending: number
	executed: number
	passRate?: number | null
	failRate?: number | null
}

export interface BuildTimelinePoint {
	testRunID: string
	testRunNumber: number
	title: string
	creationDate: number
	counts: BuildResultCounts
}

export interface BuildResults {
	// missing for the test runs without a build
	build?: ProjectBuild
	counts: BuildResultCounts
	testRuns: TestRunSummary[]
	timeline: BuildTimelinePoint[]
	timeSeconds?: number
}

export interface ProjectBuild {
	buildID: string
	buildNumber: string
	creationDate: number
	createdBy?: string
}

export interface TestCaseAttachment {
	attachmentID: string
	creationDate: number
	fileName: string
	contentType: string
	fileSize: number
	uploadedBy?: string
}

export interface CreateTestCase extends Record<string, any> {
	title: string
	description: string
	testInstructions: string
	propertyValues: Record<string, string>
	sectionID?: string
	// a section by its path, e.g. "Mobile / Login", created if missing (imports)
	sectionPath?: string
	labels?: string[]
	format?: TestCaseFormat
	steps?: StepInput[]
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

// how many test cases a bulk edit changed; deleting archives the ones used in test runs
export interface BulkEditResult {
	updated: number
	archived: number
	deleted: number
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
	createdBy?: string
	assignees: UserSummary[]
	build?: ProjectBuild
	trackTime: boolean
	// total set by an admin, replacing the tracked time
	timeOverrideSeconds?: number
	// the test plan it was launched from
	testPlanID?: string
	testPlanName?: string
}

// a template of test cases: those in its sections (and nested ones), with any of its labels, or chosen
export interface TestPlan {
	testPlanID: string
	name: string
	description?: string
	sectionIDs: string[]
	labels: string[]
	testCaseIDs: string[]
	createdBy?: string
	updatedBy?: string
	modifyDate?: number
}

// a type alias, unlike an interface, can be submitted as JSON as is
export type SaveTestPlan = {
	name: string
	description?: string
	sectionIDs: string[]
	labels: string[]
	testCaseIDs: string[]
}

export interface ProjectTestPlansOutletContext {
	project: Project
	testPlans: TestPlan[]
	testCases: TestCase[]
	sections: TestCaseSection[]
	testRuns: TestRun[]
}

export interface RunningTimer {
	userID?: string
	displayName?: string
	startedAt: number
}

export interface TimeEntry {
	timeEntryID: string
	testCaseRunID: string
	testCaseNumber: number
	testCaseTitle: string
	user?: string
	startedAt: number
	endedAt?: number
	seconds: number
	isManual: boolean
}

export interface TestRunTime {
	trackTime: boolean
	trackedSeconds: number
	overrideSeconds?: number
	totalSeconds: number
	entries: TimeEntry[]
}

export enum TestCaseRunStatus {
	pending = 'PENDING',
	pass = 'PASS',
	fail = 'FAIL',
	skip = 'SKIP',
	blocked = 'BLOCKED',
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
	executedBy?: string
	assignedTo?: UserSummary
	// time spent so far, counting running timers up to when it was loaded
	timeSeconds: number
	runningTimers: RunningTimer[]
	// when the current result was recorded
	executedAt?: number
	// every result recorded, oldest first; the latest one is the status
	results: TestCaseResult[]
	// copied from the test case when the run was created
	format?: TestCaseFormat
	steps?: TestCaseRunStep[]
}

export interface TestCaseResult {
	resultID: string
	status: TestCaseRunStatus
	notes?: string
	recordedBy?: string
	recordedByID?: string
	recordedAt: number
	// the evidence of this result
	attachments: TestCaseAttachment[]
	// how each step went, for test cases written as steps
	stepResults?: StepResult[]
}

// a result of a test case in any test run of its project
export interface TestCaseHistoryEntry {
	result: TestCaseResult
	testRunID: string
	testRunNumber: number
	testRunTitle: string
	buildNumber?: string
	// whether it's the result the test case ended with in that run
	isLatestInRun: boolean
	testRunCreationDate: number
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
	sections: TestCaseSection[]
	sharedSteps: SharedStep[]
}

export interface TestCaseOutletContext {
	project: Project
	testCase: TestCase
	properties: PropertyConfiguration[]
	propertyValues: PropertyValue[]
	sections: TestCaseSection[]
	// every label used in the project
	labels: string[]
	sharedSteps: SharedStep[]
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
	projectUsers: UserSummary[]
	builds: ProjectBuild[]
	time: TestRunTime
	sections: TestCaseSection[]
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
