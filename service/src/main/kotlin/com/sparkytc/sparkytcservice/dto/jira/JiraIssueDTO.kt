package com.sparkytc.sparkytcservice.dto.jira

data class JiraIssueDTO(
    val issueKey: String,
    val issueURL: String,
    val summary: String?,
    val status: String?,
    // jira status category key: "new", "indeterminate" or "done"
    val statusCategory: String?,
    val error: String? = null
)
