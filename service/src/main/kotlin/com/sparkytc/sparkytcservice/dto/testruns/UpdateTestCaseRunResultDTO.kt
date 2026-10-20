package com.sparkytc.sparkytcservice.dto.testruns

/** Outcome of recording a test case result, including any automatic Jira issue. */
data class UpdateTestCaseRunResultDTO(
    val jiraIssueKey: String? = null,
    val jiraError: String? = null,
    // issues that couldn't be closed or reopened, the result is saved anyway
    val jiraTransitionErrors: List<String> = emptyList(),
)
