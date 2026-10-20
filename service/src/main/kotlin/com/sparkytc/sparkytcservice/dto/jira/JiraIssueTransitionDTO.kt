package com.sparkytc.sparkytcservice.dto.jira

/** A linked issue to move along its workflow when a result is recorded, e.g. closed on a pass. */
data class JiraIssueTransitionDTO(
    val issueKey: String,
    val transitionID: String,
    // when set, the issue is assigned to this Jira user, e.g. to tell them it was reopened
    val assigneeAccountID: String? = null,
)
