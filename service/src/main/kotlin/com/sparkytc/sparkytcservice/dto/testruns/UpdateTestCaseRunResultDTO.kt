package com.sparkytc.sparkytcservice.dto.testruns

/** Outcome of recording a test case result, including any automatic Jira issue. */
data class UpdateTestCaseRunResultDTO(
    val jiraIssueKey: String? = null,
    val jiraError: String? = null
)
