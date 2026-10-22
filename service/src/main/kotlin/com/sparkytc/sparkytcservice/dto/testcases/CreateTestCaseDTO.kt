package com.sparkytc.sparkytcservice.dto.testcases

import com.sparkytc.sparkytcservice.dto.steps.StepInputDTO
import com.sparkytc.sparkytcservice.dto.steps.TestCaseFormat
import java.util.UUID

data class CreateTestCaseDTO(
    val title: String,
    val description: String?,
    val testInstructions: String?,
    val propertyValues: Map<UUID, String>,
    // the project's first suite when empty; on an update, empty keeps the current one
    val sectionID: UUID? = null,
    // on an update, null keeps the current labels
    val labels: List<String>? = null,
    // on an update, null keeps the current format and steps
    val format: TestCaseFormat? = null,
    val steps: List<StepInputDTO>? = null,
)