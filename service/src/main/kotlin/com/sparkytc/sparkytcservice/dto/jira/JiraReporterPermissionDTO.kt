package com.sparkytc.sparkytcservice.dto.jira

data class JiraReporterPermissionDTO(
    val projectKey: String,
    // whether the shared Jira account can create issues on behalf of other users in the project
    val canModifyReporter: Boolean
)
