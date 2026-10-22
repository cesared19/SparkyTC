package com.sparkytc.sparkytcservice.dto.testruns

import com.sparkytc.sparkytcservice.dto.attachments.TestCaseAttachmentDTO
import com.sparkytc.sparkytcservice.dto.steps.StepResultDTO
import java.util.Date
import java.util.UUID

data class TestCaseResultDTO(
    val resultID: UUID,
    val status: TestCaseRunStatus,
    val notes: String?,
    val recordedBy: String?,
    val recordedByID: UUID?,
    val recordedAt: Date,
    // the evidence of this result
    val attachments: List<TestCaseAttachmentDTO> = emptyList(),
    // how each step went, for test cases written as steps
    val stepResults: List<StepResultDTO> = emptyList(),
)
