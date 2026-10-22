export class Route {
	static get index() {
		return '/'
	}

	static get newProject() {
		return '/projects/new'
	}

	static viewProjectTestCases(projectShortCode: string) {
		return `/test-cases/${projectShortCode}`
	}

	static viewTestCase(projectShortCode: string, testCaseNumber: number) {
		return `/test-cases/${projectShortCode}/${testCaseNumber}`
	}

	static viewProjectDashboard(projectShortCode: string) {
		return `/projects/${projectShortCode}`
	}

	static get preferences() {
		return '/preferences'
	}

	static projectSettings(projectShortCode: string) {
		return `/projects/${projectShortCode}/settings`
	}

	static viewProjectBuilds(projectShortCode: string) {
		return `/projects/${projectShortCode}/builds`
	}

	static get assignments() {
		return '/assignments'
	}

	static get builds() {
		return '/builds'
	}

	static jiraIssueTypes(projectKey: string) {
		return `/jira-issue-types?${new URLSearchParams({ projectKey }).toString()}`
	}

	static jiraUsers(query: string) {
		return `/jira-users?${new URLSearchParams({ query }).toString()}`
	}

	static get linkJiraUser() {
		return '/jira-users'
	}

	static get timers() {
		return '/timers'
	}

	static get notifications() {
		return '/notifications'
	}

	static similarJiraIssues(testCaseRunID: string, summary: string) {
		const params = new URLSearchParams({ testCaseRunID, summary })
		return `/jira-similar?${params.toString()}`
	}

	static attachment(attachmentID: string) {
		return `/attachments/${attachmentID}`
	}

	static testCaseAttachments(testCaseID: string) {
		return `/test-case-attachments/${testCaseID}`
	}

	static get sections() {
		return '/sections'
	}

	static get bulkEdit() {
		return '/bulk-edit'
	}

	static get sharedSteps() {
		return '/shared-steps'
	}

	static resultEvidence(resultID: string) {
		return `/test-case-result-evidence/${resultID}`
	}

	static testCaseResult(resultID: string) {
		return `/test-case-results/${resultID}`
	}

	static testCaseHistory(testCaseID: string) {
		return `/test-case-history/${testCaseID}`
	}

	static jiraTransitions(testCaseRunID: string, issueKey: string) {
		return `/jira-transitions?${new URLSearchParams({
			testCaseRunID,
			issueKey,
		}).toString()}`
	}

	static jiraAssignees(testCaseRunID: string, issueKey: string, query: string) {
		return `/jira-assignees?${new URLSearchParams({
			testCaseRunID,
			issueKey,
			query,
		}).toString()}`
	}

	static jiraIssues(issueKeys: string[]) {
		const params = new URLSearchParams()
		issueKeys.forEach((key) => params.append('keys', key))
		return `/jira-issues?${params.toString()}`
	}

	static testCaseJiraLinks(testCaseID: string) {
		return `/test-case-jira-links/${testCaseID}`
	}

	static jiraLink(linkID: string) {
		return `/jira-links/${linkID}`
	}

	static viewProjectTestRuns(projectShortCode: string) {
		return `/test-runs/${projectShortCode}`
	}

	static viewTestPlans(projectShortCode: string) {
		return `/test-plans/${projectShortCode}`
	}

	static viewTestPlan(projectShortCode: string, testPlanID: string) {
		return `/test-plans/${projectShortCode}/${testPlanID}`
	}

	// the new test run form with the plan's test cases chosen
	static newTestRunFromPlan(projectShortCode: string, testPlanID: string) {
		return `/test-runs/${projectShortCode}/new?plan=${testPlanID}`
	}

	static viewTestRun(projectShortCode: string, testRunNumber: number) {
		return `/test-runs/${projectShortCode}/${testRunNumber}`
	}

	static viewTestCaseRun(
		projectShortCode: string,
		testRunNumber: number,
		testCaseNumber: number
	) {
		return `/test-runs/${projectShortCode}/${testRunNumber}/${testCaseNumber}`
	}

	static get logout() {
		return '/logout'
	}

	static get account() {
		return '/account'
	}

	static get users() {
		return '/admin/users'
	}

	static get viewProperties() {
		return '/configuration/properties'
	}

	static viewProperty(propertyID: string) {
		return `/configuration/properties/${propertyID}`
	}
}

export class APIRoute {
	private static get baseAPIURL() {
		return process.env.VITE_API_URL
	}

	static get projects() {
		return `${this.baseAPIURL}/api/v1/workspace/projects`
	}

	static projectDashboard(projectShortCode: string) {
		return `${this.baseAPIURL}/api/v1/workspace/projects/${projectShortCode}/dashboard`
	}

	static projectUsers(projectShortCode: string) {
		return `${this.baseAPIURL}/api/v1/workspace/projects/${projectShortCode}/users`
	}

	static projectSettings(projectShortCode: string) {
		return `${this.baseAPIURL}/api/v1/workspace/projects/${projectShortCode}/settings`
	}

	static projectBuildResults(projectShortCode: string) {
		return `${this.baseAPIURL}/api/v1/workspace/projects/${projectShortCode}/build-results`
	}

	static projectBuilds(projectShortCode: string) {
		return `${this.baseAPIURL}/api/v1/workspace/projects/${projectShortCode}/builds`
	}

	static build(buildID: string) {
		return `${this.baseAPIURL}/api/v1/workspace/builds/${buildID}`
	}

	static timer(testCaseRunID: string, action: 'start' | 'pause') {
		return `${this.baseAPIURL}/api/v1/workspace/test-case-runs/${testCaseRunID}/timer/${action}`
	}

	static testRunTime(testRunID: string) {
		return `${this.baseAPIURL}/api/v1/workspace/test-runs/${testRunID}/time`
	}

	static testRunBuild(testRunID: string) {
		return `${this.baseAPIURL}/api/v1/workspace/test-runs/${testRunID}/build`
	}

	static testRunAssignees(testRunID: string) {
		return `${this.baseAPIURL}/api/v1/workspace/test-runs/${testRunID}/assignees`
	}

	static testCaseRunAssignee(testCaseRunID: string) {
		return `${this.baseAPIURL}/api/v1/workspace/test-case-runs/${testCaseRunID}/assignee`
	}

	static similarJiraIssues(testCaseRunID: string, summary: string) {
		const params = new URLSearchParams({ summary })
		return `${
			this.baseAPIURL
		}/api/v1/workspace/test-case-runs/${testCaseRunID}/similar-jira-issues?${params.toString()}`
	}

	static get notifications() {
		return `${this.baseAPIURL}/api/v1/notifications`
	}

	static notificationRead(notificationID: string) {
		return `${this.baseAPIURL}/api/v1/notifications/${notificationID}/read`
	}

	static get notificationsReadAll() {
		return `${this.baseAPIURL}/api/v1/notifications/read-all`
	}

	static notification(notificationID: string) {
		return `${this.baseAPIURL}/api/v1/notifications/${notificationID}`
	}

	static get notificationsRead() {
		return `${this.baseAPIURL}/api/v1/notifications/read`
	}

	static get notificationPreferences() {
		return `${this.baseAPIURL}/api/v1/auth/preferences/notifications`
	}

	static get themePreference() {
		return `${this.baseAPIURL}/api/v1/auth/preferences/theme`
	}

	static get defaultProjectPreference() {
		return `${this.baseAPIURL}/api/v1/auth/preferences/default-project`
	}

	static userProjects(userID: string) {
		return `${this.baseAPIURL}/api/v1/admin/users/${userID}/projects`
	}

	static projectTestCases(projectShortCode: string) {
		return `${this.baseAPIURL}/api/v1/workspace/test-cases/${projectShortCode}`
	}

	static testCase(testCaseID: string) {
		return `${this.baseAPIURL}/api/v1/workspace/test-cases/${testCaseID}`
	}

	static projectSections(projectShortCode: string) {
		return `${this.baseAPIURL}/api/v1/workspace/projects/${projectShortCode}/sections`
	}

	static section(sectionID: string) {
		return `${this.baseAPIURL}/api/v1/workspace/sections/${sectionID}`
	}

	static reorderSection(sectionID: string) {
		return `${this.baseAPIURL}/api/v1/workspace/sections/${sectionID}/reorder`
	}

	static projectSharedSteps(projectShortCode: string) {
		return `${this.baseAPIURL}/api/v1/workspace/projects/${projectShortCode}/shared-steps`
	}

	static sharedStep(sharedStepID: string) {
		return `${this.baseAPIURL}/api/v1/workspace/shared-steps/${sharedStepID}`
	}

	static projectTestRun(projectShortCode: string, testRunNumber: number) {
		return `${this.baseAPIURL}/api/v1/workspace/projects/${projectShortCode}/test-runs/${testRunNumber}`
	}

	static get bulkEditTestCases() {
		return `${this.baseAPIURL}/api/v1/workspace/test-cases/bulk`
	}

	static get bulkDeleteTestCases() {
		return `${this.baseAPIURL}/api/v1/workspace/test-cases/bulk-delete`
	}

	static get bulkAssignTestCaseRuns() {
		return `${this.baseAPIURL}/api/v1/workspace/test-case-runs/bulk-assignee`
	}

	static batchCreateTestCases(projectShortCode: string) {
		return `${this.baseAPIURL}/api/v1/workspace/test-cases/${projectShortCode}/batch`
	}

	static testCaseAttachments(testCaseID: string) {
		return `${this.baseAPIURL}/api/v1/workspace/test-cases/${testCaseID}/attachments`
	}

	static attachment(attachmentID: string) {
		return `${this.baseAPIURL}/api/v1/workspace/attachments/${attachmentID}`
	}

	static resultEvidence(resultID: string) {
		return `${this.baseAPIURL}/api/v1/workspace/test-case-results/${resultID}/attachments`
	}

	static testCaseResult(resultID: string) {
		return `${this.baseAPIURL}/api/v1/workspace/test-case-results/${resultID}`
	}

	static rerunTestRun(testRunID: string) {
		return `${this.baseAPIURL}/api/v1/workspace/test-runs/${testRunID}/rerun`
	}

	static testCaseHistory(testCaseID: string) {
		return `${this.baseAPIURL}/api/v1/workspace/test-cases/${testCaseID}/history`
	}

	static get jiraConfiguration() {
		return `${this.baseAPIURL}/api/v1/workspace/jira/configuration`
	}

	static get jiraSpaces() {
		return `${this.baseAPIURL}/api/v1/workspace/jira/projects`
	}

	static jiraReporterPermission(projectKey: string) {
		return `${
			this.baseAPIURL
		}/api/v1/workspace/jira/projects/${encodeURIComponent(
			projectKey
		)}/reporter-permission`
	}

	static jiraUsers(query: string) {
		return `${this.baseAPIURL}/api/v1/auth/jira-users?${new URLSearchParams({
			query,
		}).toString()}`
	}

	static get ownJiraUser() {
		return `${this.baseAPIURL}/api/v1/auth/jira-user`
	}

	static userJiraUser(userID: string) {
		return `${this.baseAPIURL}/api/v1/admin/users/${userID}/jira-user`
	}

	static jiraIssueTypes(projectKey: string) {
		return `${
			this.baseAPIURL
		}/api/v1/workspace/jira/projects/${encodeURIComponent(
			projectKey
		)}/issue-types`
	}

	static jiraIssues(issueKeys: string[]) {
		const params = new URLSearchParams()
		issueKeys.forEach((key) => params.append('keys', key))
		return `${
			this.baseAPIURL
		}/api/v1/workspace/jira/issues?${params.toString()}`
	}

	static testCaseJiraLinks(testCaseID: string) {
		return `${this.baseAPIURL}/api/v1/workspace/test-cases/${testCaseID}/jira-links`
	}

	static jiraLink(linkID: string) {
		return `${this.baseAPIURL}/api/v1/workspace/jira-links/${linkID}`
	}

	static jiraTransitions(testCaseRunID: string, issueKey: string) {
		return `${
			this.baseAPIURL
		}/api/v1/workspace/test-case-runs/${testCaseRunID}/jira-issues/${encodeURIComponent(
			issueKey
		)}/transitions`
	}

	static jiraAssignableUsers(
		testCaseRunID: string,
		issueKey: string,
		query: string
	) {
		return `${
			this.baseAPIURL
		}/api/v1/workspace/test-case-runs/${testCaseRunID}/jira-issues/${encodeURIComponent(
			issueKey
		)}/assignable-users?${new URLSearchParams({ query }).toString()}`
	}

	static createJiraIssue(testCaseRunID: string) {
		return `${this.baseAPIURL}/api/v1/workspace/test-case-runs/${testCaseRunID}/jira-issue`
	}

	static projectTestRuns(projectShortCode: string) {
		return `${this.baseAPIURL}/api/v1/workspace/test-runs/${projectShortCode}`
	}

	static projectTestPlans(projectShortCode: string) {
		return `${this.baseAPIURL}/api/v1/workspace/projects/${projectShortCode}/test-plans`
	}

	static testPlan(testPlanID: string) {
		return `${this.baseAPIURL}/api/v1/workspace/test-plans/${testPlanID}`
	}

	static testRun(testRunID: string) {
		return `${this.baseAPIURL}/api/v1/workspace/test-runs/${testRunID}`
	}

	static projectTestCaseRuns(projectShortCode: string, testRunNumber: number) {
		return `${this.baseAPIURL}/api/v1/workspace/test-case-runs/${projectShortCode}/${testRunNumber}`
	}

	static testCaseRun(testCaseRunID: string) {
		return `${this.baseAPIURL}/api/v1/workspace/test-case-runs/${testCaseRunID}`
	}

	static testCaseRunDetails(testCaseRunID: string) {
		return `${this.baseAPIURL}/api/v1/workspace/test-case-runs/${testCaseRunID}/details`
	}

	static nextTestCaseRun(testCaseRunID: string) {
		return `${this.baseAPIURL}/api/v1/workspace/test-case-runs/${testCaseRunID}/next`
	}

	static get login() {
		return `${this.baseAPIURL}/api/v1/auth/login`
	}

	static get logout() {
		return `${this.baseAPIURL}/api/v1/auth/logout`
	}

	static get currentUser() {
		return `${this.baseAPIURL}/api/v1/auth/me`
	}

	static get changePassword() {
		return `${this.baseAPIURL}/api/v1/auth/password`
	}

	static get users() {
		return `${this.baseAPIURL}/api/v1/admin/users`
	}

	static user(userID: string) {
		return `${this.baseAPIURL}/api/v1/admin/users/${userID}`
	}

	static get properties() {
		return `${this.baseAPIURL}/api/v1/workspace/properties`
	}

	static property(propertyID: string) {
		return `${this.baseAPIURL}/api/v1/workspace/properties/${propertyID}`
	}
}
