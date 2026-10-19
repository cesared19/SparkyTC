package com.sparkytc.sparkytcservice.dto.jira

// a Jira project, shown as a space in newer Jira Cloud sites
data class JiraProjectDTO(
    val key: String,
    val name: String
)
