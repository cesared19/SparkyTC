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
    /** What the token can do: ["read"] or ["read", "write"]. */
    val permissions: List<String> = listOf("read"),
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
    /** The reference the app gave it when creating it, if any. */
    val sourceRef: String? = null,
    /** Only when creating: false when a test case with the same sourceRef already existed and is returned instead. */
    val created: Boolean? = null,
)

data class IntegrationTestPlanDTO(
    val testPlanID: UUID,
    val name: String,
    val description: String?,
    val testCaseCount: Int,
    val webPath: String,
    val sourceRef: String? = null,
    /** Only when creating: false when a test plan with the same sourceRef already existed and is returned instead. */
    val created: Boolean? = null,
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

/** A section to create by its path, e.g. "Checkout / Payments"; the parts that exist are reused. */
data class IntegrationCreateSectionDTO(val path: String? = null)

data class IntegrationStepDTO(val action: String? = null, val expected: String? = null)

data class IntegrationCreateTestCaseDTO(
    val title: String? = null,
    val description: String? = null,
    /** Free text instructions, for the TEXT format. */
    val testInstructions: String? = null,
    /** Created if missing; the project's first suite when empty. */
    val sectionPath: String? = null,
    val labels: List<String>? = null,
    /** TEXT or STEPS; STEPS when there are steps and no format is given. */
    val format: String? = null,
    val steps: List<IntegrationStepDTO>? = null,
    /** The app's reference, e.g. "cobord:<boardId>:<elementId>": creating twice returns the first test case. */
    val sourceRef: String? = null,
)

data class IntegrationCreateTestPlanDTO(
    val name: String? = null,
    val description: String? = null,
    val sectionIDs: List<UUID>? = null,
    val labels: List<String>? = null,
    val testCaseNumbers: List<Long>? = null,
    val sourceRef: String? = null,
)

/** A test case with what it says to do, and its results in the project's test runs, newest first. */
data class IntegrationTestCaseHistoryDTO(
    val testCase: IntegrationTestCaseDTO,
    val description: String?,
    val testInstructions: String?,
    /** TEXT or STEPS. */
    val format: String,
    /** For test cases written as steps; shared steps come expanded, with their name. */
    val steps: List<IntegrationTestStepDTO>,
    /** Archived: deleted after being used in test runs, kept for their results. */
    val archived: Boolean,
    /** How many results there are in all; `results` has up to `limit` of them. */
    val total: Int,
    val results: List<IntegrationHistoryEntryDTO>,
)

/** A step as the test case says it, for reading; shared steps come expanded, with their name. */
data class IntegrationTestStepDTO(
    val action: String,
    val expected: String?,
    val sharedStepName: String? = null,
)

data class IntegrationHistoryEntryDTO(
    val status: IntegrationResultStatus,
    val notes: String?,
    val recordedBy: String?,
    val recordedAt: Date,
    val testRunNumber: Long,
    val testRunTitle: String,
    val buildNumber: String?,
    /** Whether it's the result the test case ended with in that run (a run can have several). */
    val isLatestInRun: Boolean,
    /** How each step went, as the steps were when the run started. */
    val steps: List<IntegrationStepResultDTO>,
    val evidenceCount: Int,
    /** The test case in that run, in the SparkyTC app. */
    val webPath: String,
)

data class IntegrationStepResultDTO(
    val action: String,
    val expected: String?,
    val status: IntegrationResultStatus?,
    val actual: String?,
)

/** A test run to create for a build: test cases by number and/or a test plan's test cases. */
data class IntegrationCreateTestRunDTO(
    val title: String? = null,
    val description: String? = null,
    /** Build number; it must already be registered in the project. */
    val build: String? = null,
    val testCaseNumbers: List<Long>? = null,
    val testPlanID: UUID? = null,
    val sourceRef: String? = null,
)

/** A test case in a test run, with its latest result there. */
data class IntegrationTestRunCaseDTO(
    val testCaseNumber: Long,
    val title: String,
    val status: IntegrationResultStatus,
    /** The test case in this run, in the app. */
    val webPath: String,
)

data class IntegrationTestRunDTO(
    val testRunID: UUID,
    val testRunNumber: Long,
    val title: String,
    /** PENDING, IN_PROGRESS, COMPLETE or ABORT. */
    val status: String,
    val build: IntegrationBuildDTO?,
    /** Created through the integration API. */
    val automated: Boolean,
    val testPlanID: UUID?,
    val testCases: List<IntegrationTestRunCaseDTO>,
    val webPath: String,
    val sourceRef: String? = null,
    /** Only when creating: false when a test run with the same sourceRef already existed and is returned instead. */
    val created: Boolean? = null,
)

/** A result to record for a test case of an automated test run. */
data class IntegrationRecordResultDTO(
    val testCaseNumber: Long? = null,
    /** PASS, FAIL, BLOCKED or SKIP. */
    val status: String? = null,
    val notes: String? = null,
    /** How long the test case took; it's the test case's time in the run. */
    val durationSeconds: Long? = null,
    val report: IntegrationResultReportDTO? = null,
)

/** What an app found, stored with the result and shown in SparkyTC, e.g. a replay compared with its recording. */
data class IntegrationResultReportDTO(
    val passed: Boolean? = null,
    val findings: List<String>? = null,
    val screenshots: List<IntegrationReportScreenshotDTO>? = null,
    val metrics: IntegrationReportMetricsDTO? = null,
)

data class IntegrationReportScreenshotDTO(
    val name: String? = null,
    /** Percentage of pixels that differ from the recording, 0–100. */
    val differentPercent: Double? = null,
    val passed: Boolean? = null,
)

/** Performance of the recording and of the replay. */
data class IntegrationReportMetricsDTO(
    val recorded: IntegrationReportMetricSetDTO? = null,
    val replay: IntegrationReportMetricSetDTO? = null,
)

data class IntegrationReportMetricSetDTO(
    val averageFps: Double? = null,
    val frameTimeP50Ms: Double? = null,
    val frameTimeP95Ms: Double? = null,
    val frameTimeP99Ms: Double? = null,
    /** Percentage of frames over one refresh interval. */
    val overBudgetPercent: Double? = null,
    val droppedFrames: Long? = null,
    val cpuAvgMs: Double? = null,
    val gpuAvgMs: Double? = null,
    val usedMemoryPeakMB: Double? = null,
    val batteryTemperatureMaxC: Double? = null,
)

data class IntegrationRecordedResultDTO(
    /** For uploading the result's evidence. */
    val resultID: UUID,
    val testRunNumber: Long,
    val testCaseNumber: Long,
    val status: IntegrationResultStatus,
    /** The run's status after this result: COMPLETE once every test case has a final result. */
    val testRunStatus: String,
    /** The test case in the run, in the app. */
    val webPath: String,
)

/** A file attached to a result through the integration API. */
data class IntegrationAttachmentDTO(
    val attachmentID: UUID,
    val fileName: String,
    val contentType: String,
    val fileSize: Long,
)

