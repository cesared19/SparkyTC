package com.sparkytc.sparkytcservice.dto.jira

data class LinkJiraIssueDTO(
    // accepts an issue key (SCRUM-123) or an issue URL
    val issue: String,
    val appBaseURL: String?
)
