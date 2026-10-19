package com.sparkytc.sparkytcservice.dto.jira

data class JiraUserDTO(
    val accountID: String,
    val displayName: String,
    // only present when the user's Atlassian privacy settings show it
    val emailAddress: String? = null,
    val avatarURL: String? = null
)
