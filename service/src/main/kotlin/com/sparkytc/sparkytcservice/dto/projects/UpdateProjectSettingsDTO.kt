package com.sparkytc.sparkytcservice.dto.projects

data class UpdateProjectSettingsDTO(
    val jiraFailureMode: JiraFailureMode,
    // null uses the default JIRA_PROJECT_KEY
    val jiraProjectKey: String?
)
