package com.sparkytc.sparkytcservice.dto.testruns

import com.sparkytc.sparkytcservice.dto.auth.UserSummaryDTO
import com.sparkytc.sparkytcservice.dto.testcases.TestCaseDTO
import com.sparkytc.sparkytcservice.models.TestCaseRun
import java.util.Date
import java.util.UUID

data class TestCaseRunDTO(
    val testCaseRunID: UUID,
    val creationDate: Date,
    val testCase: TestCaseDTO,
    val status: TestCaseRunStatus,
    val title: String,
    val description: String?,
    val testInstructions: String?,
    val notes: String?,
    val executedBy: String? = null,
    val assignedTo: UserSummaryDTO? = null
)
