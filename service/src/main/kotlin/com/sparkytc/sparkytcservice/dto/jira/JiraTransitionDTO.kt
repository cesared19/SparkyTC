package com.sparkytc.sparkytcservice.dto.jira

/** A workflow transition available for a Jira issue, and the status it leads to. */
data class JiraTransitionDTO(
    val transitionID: String,
    val name: String,
    val toStatus: String?,
    // jira status category key of the target status: "new", "indeterminate" or "done"
    val toStatusCategory: String?,
)
