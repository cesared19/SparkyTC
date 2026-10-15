package com.sparkytc.sparkytcservice.dto.jira

import com.fasterxml.jackson.annotation.JsonProperty

data class JiraConfigurationDTO(
    @JsonProperty("isEnabled")
    val isEnabled: Boolean,
    val baseURL: String?,
    val projectKey: String?,
    val issueType: String?
)
