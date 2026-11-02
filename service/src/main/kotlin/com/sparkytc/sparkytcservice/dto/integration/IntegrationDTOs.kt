package com.sparkytc.sparkytcservice.dto.integration

import java.util.Date
import java.util.UUID

/** Result of a test case in the integration API: its latest executed result, or NOT_RUN. */
enum class IntegrationResultStatus { PASS, FAIL, BLOCKED, SKIP, NOT_RUN }

data class IntegrationBuildDTO(val buildID: UUID, val buildNumber: String)

data class IntegrationProjectDTO(
    val projectShortCode: String,
    val title: String,
    val currentBuild: IntegrationBuildDTO?,
    val builds: List<IntegrationBuildDTO>,
    val webPath: String,
)

data class IntegrationSectionDTO(
    val sectionID: UUID,
    val parentID: UUID?,
    val name: String,
    /** Names from the suite down, e.g. "Checkout / Payments". */
    val path: String,
    /** Test cases in the section and the sections nested in it. */
    val testCaseCount: Int,
    val webPath: String,
)

data class IntegrationTestCaseDTO(
    val testCaseID: UUID,
    val testCaseNumber: Long,
    val title: String,
    val sectionPath: String?,
    val labels: List<String>,
    val webPath: String,
)

data class IntegrationTestPlanDTO(
    val testPlanID: UUID,
    val name: String,
    val description: String?,
    val testCaseCount: Int,
    val webPath: String,
)

data class IntegrationResultsRequestDTO(
    val testCaseNumbers: List<Long>? = null,
    val sectionIDs: List<UUID>? = null,
    val testPlanIDs: List<UUID>? = null,
    /** A build number; the current build when missing. */
    val build: String? = null,
)

data class IntegrationCountsDTO(
    val total: Int,
    val passed: Int,
    val failed: Int,
    val blocked: Int,
    val skipped: Int,
    val notRun: Int,
)

data class IntegrationTestCaseResultDTO(
    val testCaseNumber: Long,
    val title: String,
    val status: IntegrationResultStatus,
    val executedAt: Date?,
    val executedBy: String?,
    val testRunNumber: Long?,
    val webPath: String,
)

data class IntegrationGroupResultDTO(
    val id: UUID,
    val name: String,
    val counts: IntegrationCountsDTO,
    /** The status that sums up the group: FAIL or BLOCKED if any case has it, NOT_RUN if any is pending, else PASS or SKIP. */
    val status: IntegrationResultStatus?,
    val webPath: String,
)

data class IntegrationResultsDTO(
    /** The build the results are from; null when the project has no builds and every test run counts. */
    val build: IntegrationBuildDTO?,
    val testCases: List<IntegrationTestCaseResultDTO>,
    val sections: List<IntegrationGroupResultDTO>,
    val testPlans: List<IntegrationGroupResultDTO>,
    /** Requested items that don't exist anymore (deleted or archived). */
    val missingTestCaseNumbers: List<Long>,
    val missingSectionIDs: List<UUID>,
    val missingTestPlanIDs: List<UUID>,
)
