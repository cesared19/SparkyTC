package com.sparkytc.sparkytcservice.dto.testruns

import java.util.Date
import java.util.UUID

data class TestRunDTO(
    val testRunID: UUID,
    val creationDate: Date,
    val testRunNumber: Long,
    val status: TestRunStatus,
    val title: String,
    val description: String?,
    val createdBy: String? = null
)