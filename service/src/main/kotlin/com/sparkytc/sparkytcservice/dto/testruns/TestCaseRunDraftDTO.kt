package com.sparkytc.sparkytcservice.dto.testruns

import com.sparkytc.sparkytcservice.dto.steps.StepResultDTO
import java.util.Date

/** A result being prepared: what the user has chosen and written so far, before saving it. */
data class TestCaseRunDraftDTO(
    val status: TestCaseRunStatus? = null,
    val notes: String? = null,
    val stepResults: List<StepResultDTO> = emptyList(),
    val updatedAt: Date? = null,
)
