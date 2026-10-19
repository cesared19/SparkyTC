package com.sparkytc.sparkytcservice.dto.auth

data class UpdateJiraUserDTO(
    // the Jira account issues are reported as, null unlinks it
    val accountID: String?
)
