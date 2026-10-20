package com.sparkytc.sparkytcservice.dto.time

import java.util.Date
import java.util.UUID

data class RunningTimerDTO(
    val userID: UUID?,
    val displayName: String?,
    val startedAt: Date,
)

data class TimeEntryDTO(
    val timeEntryID: UUID,
    val testCaseRunID: UUID,
    val testCaseNumber: Long,
    val testCaseTitle: String,
    val user: String?,
    val startedAt: Date,
    val endedAt: Date?,
    val seconds: Long,
    val isManual: Boolean,
)

/** Time spent on a test run: the tracked time, or the total an admin set once it was closed. */
data class TestRunTimeDTO(
    val trackTime: Boolean,
    val trackedSeconds: Long,
    // set by an admin, replaces the tracked time
    val overrideSeconds: Long?,
    val totalSeconds: Long,
    val entries: List<TimeEntryDTO>,
)

data class UpdateTestRunTimeDTO(
    // null goes back to the tracked time
    val totalSeconds: Long?,
)
