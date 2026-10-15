package com.sparkytc.sparkytcservice.dto.jira

import java.util.Date
import java.util.UUID

data class JiraLinkDTO(
    val linkID: UUID,
    val creationDate: Date,
    val issueKey: String,
    val issueURL: String
)
