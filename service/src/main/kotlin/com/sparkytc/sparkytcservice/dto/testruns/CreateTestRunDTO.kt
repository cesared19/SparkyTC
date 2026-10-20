package com.sparkytc.sparkytcservice.dto.testruns

import java.util.UUID

data class CreateTestRunDTO(
    val title: String,
    val description: String?,
    val testCaseIDs: List<UUID>,
    val assigneeIDs: List<UUID> = emptyList(),
    val buildID: UUID? = null,
    val trackTime: Boolean = false,
)