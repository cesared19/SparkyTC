package com.sparkytc.sparkytcservice.dto.builds

import com.sparkytc.sparkytcservice.dto.dashboard.TestRunSummaryDTO
import java.util.Date
import java.util.UUID

/**
 * Results of the test cases run on a build, counting only the latest executed result of each test case
 * across its test runs. Rates are over the executed results (pass, fail and skip) and null when none ran.
 */
data class BuildResultCountsDTO(
    val testCaseCount: Int,
    val passed: Int,
    val failed: Int,
    val skipped: Int,
    val pending: Int,
    val passRate: Double?,
    val failRate: Double?,
) {
    val executed: Int
        get() = passed + failed + skipped
}

/** The state of a build after one of its test runs, including the test runs before it. */
data class BuildTimelinePointDTO(
    val testRunID: UUID,
    val testRunNumber: Long,
    val title: String,
    val creationDate: Date,
    val counts: BuildResultCountsDTO,
)

data class BuildResultsDTO(
    // null groups the test runs without a build
    val build: ProjectBuildDTO?,
    val counts: BuildResultCountsDTO,
    val testRuns: List<TestRunSummaryDTO>,
    val timeline: List<BuildTimelinePointDTO>,
    // time spent on the build's test runs that track time, null when none does
    val timeSeconds: Long? = null,
)
