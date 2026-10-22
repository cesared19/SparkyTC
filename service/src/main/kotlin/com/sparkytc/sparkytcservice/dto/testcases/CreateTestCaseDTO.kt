package com.sparkytc.sparkytcservice.dto.testcases

import java.util.UUID

data class CreateTestCaseDTO(
    val title: String,
    val description: String?,
    val testInstructions: String?,
    val propertyValues: Map<UUID, String>,
    // the project's first suite when empty; on an update, empty keeps the current one
    val sectionID: UUID? = null,
)