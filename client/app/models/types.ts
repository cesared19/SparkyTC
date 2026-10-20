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

// latest executed result of each test case on a build; rates are over pass, fail and skip
export interface BuildResultCounts {
	testCaseCount: number
	passed: number
	failed: number
	skipped: number
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
	createdBy?: string
	assignees: UserSummary[]
	build?: ProjectBuild
	trackTime: boolean
	// total set by an admin, replacing the tracked time
	timeOverrideSeconds?: number
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
	projectUsers: UserSummary[]
	builds: ProjectBuild[]
	time: TestRunTime
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
