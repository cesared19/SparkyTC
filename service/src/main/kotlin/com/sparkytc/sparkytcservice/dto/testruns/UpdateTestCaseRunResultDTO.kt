package com.sparkytc.sparkytcservice.dto.testruns

import java.util.UUID

/** Outcome of recording a test case result, including any automatic Jira issue. */
data class UpdateTestCaseRunResultDTO(
    // the result just recorded, to upload its evidence
    val resultID: UUID? = null,
    val jiraIssueKey: String? = null,
    val jiraError: String? = null,
    // issues that couldn't be closed or reopened, the result is saved anyway
    val jiraTransitionErrors: List<String> = emptyList(),
)
