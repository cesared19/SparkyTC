package com.sparkytc.sparkytcservice.dto.testruns

import java.util.Date
import java.util.UUID

/** A result of a test case in any test run of its project, for its history. */
data class TestCaseHistoryEntryDTO(
    val result: TestCaseResultDTO,
    val testRunID: UUID,
    val testRunNumber: Long,
    val testRunTitle: String,
    val buildNumber: String?,
    // whether it's the result the test case ended with in that run
    val isLatestInRun: Boolean,
    val testRunCreationDate: Date,
)
