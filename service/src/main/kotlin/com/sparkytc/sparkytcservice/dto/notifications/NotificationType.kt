package com.sparkytc.sparkytcservice.dto.notifications

enum class NotificationType {
    TEST_RUN_ASSIGNED,
    TEST_RUN_COMPLETED,
    // an automatic Jira issue couldn't be created for a failed test case
    JIRA_ISSUE_FAILED,
    // a Jira issue was created, but Jira didn't accept the user as its reporter
    JIRA_REPORTER_NOT_SET
}
