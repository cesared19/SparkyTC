package com.sparkytc.sparkytcservice.dto.testruns

import com.sparkytc.sparkytcservice.dto.auth.UserSummaryDTO
import com.sparkytc.sparkytcservice.dto.testcases.TestCaseDTO
import com.sparkytc.sparkytcservice.dto.time.RunningTimerDTO
import com.sparkytc.sparkytcservice.dto.steps.TestCaseFormat
import com.sparkytc.sparkytcservice.dto.steps.TestCaseRunStepDTO
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
    val assignedTo: UserSummaryDTO? = null,
    // time spent on the test case so far, counting running timers up to now
    val timeSeconds: Long = 0,
    val runningTimers: List<RunningTimerDTO> = emptyList(),
    // when the current result was recorded
    val executedAt: Date? = null,
    // every result recorded, oldest first
    val results: List<TestCaseResultDTO> = emptyList(),
    val format: TestCaseFormat = TestCaseFormat.TEXT,
    val steps: List<TestCaseRunStepDTO> = emptyList(),
)
