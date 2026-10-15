package com.sparkytc.sparkytcservice.dto.jira

data class SimilarJiraIssueDTO(
    val issueKey: String,
    val issueURL: String,
    val summary: String,
    val status: String?,
    val statusCategory: String?,
    // share of the significant words both summaries have in common, from 0 to 1
    val similarity: Double
)
