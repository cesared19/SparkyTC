package com.sparkytc.sparkytcservice.services

import com.sparkytc.sparkytcservice.dto.builds.BuildResultCountsDTO
import com.sparkytc.sparkytcservice.dto.builds.BuildResultsDTO
import com.sparkytc.sparkytcservice.dto.builds.BuildTimelinePointDTO
import com.sparkytc.sparkytcservice.dto.builds.ProjectBuildDTO
import com.sparkytc.sparkytcservice.dto.dashboard.TestRunSummaryDTO
import com.sparkytc.sparkytcservice.dto.testruns.TestCaseRunStatus
import com.sparkytc.sparkytcservice.models.TestCaseRun
import com.sparkytc.sparkytcservice.models.TestRun
import com.sparkytc.sparkytcservice.models.WorkspaceProject
import com.sparkytc.sparkytcservice.repositories.ProjectBuildRepository
import com.sparkytc.sparkytcservice.repositories.TestCaseRunRepository
import com.sparkytc.sparkytcservice.repositories.TestRunRepository
import com.sparkytc.sparkytcservice.repositories.WorkspaceProjectRepository
import jakarta.transaction.Transactional
import org.springframework.stereotype.Service

/** Test results per build, for the dashboard timeline and the Builds tab. */
@Service
class BuildResultsService(
    private val projectRepository: WorkspaceProjectRepository,
    private val projectBuildRepository: ProjectBuildRepository,
    private val testRunRepository: TestRunRepository,
    private val testCaseRunRepository: TestCaseRunRepository,
    private val projectAccessService: ProjectAccessService,
    private val timeTrackingService: TimeTrackingService,
) {
    /** Every build of the project, newest first, followed by the test runs without a build when there are any. */
    @Transactional
    fun retrieveBuildResults(projectShortCode: String): List<BuildResultsDTO> {
        val project = projectRepository.findByProjectShortCode(projectShortCode)
        requireNotNull(project) { "No project found" }
        projectAccessService.requireAccess(project)

        val runsByBuild = runsWithResults(project).groupBy { (testRun, _) -> testRun.build?.id }
        val builds = projectBuildRepository.findAllByProjectOrderByIdDesc(project).map { build ->
            results(build.toDTO(), runsByBuild[build.id].orEmpty())
        }
        val withoutBuild = runsByBuild[null]?.let { listOf(results(null, it)) }.orEmpty()
        return builds + withoutBuild
    }

    /** Time spent on the current build's test runs that track time, null when none does. */
    @Transactional
    fun currentBuildTime(project: WorkspaceProject): Long? {
        val build = projectBuildRepository.findTopByProjectOrderByIdDesc(project) ?: return null
        return time(testRunRepository.findAllByProject(project).filter { it.build?.id == build.id })
    }

    private fun time(testRuns: List<TestRun>): Long? {
        val totals = timeTrackingService.totals(testRuns)
        return if (totals.isEmpty()) null else totals.values.sum()
    }

    /** How the project's current build evolved over its test runs. */
    @Transactional
    fun currentBuildTimeline(project: WorkspaceProject): List<BuildTimelinePointDTO> {
        val build = projectBuildRepository.findTopByProjectOrderByIdDesc(project) ?: return emptyList()
        return timeline(runsWithResults(project).filter { (testRun, _) -> testRun.build?.id == build.id })
    }

    fun summary(testRun: TestRun, testCaseRuns: List<TestCaseRun>): TestRunSummaryDTO {
        return TestRunSummaryDTO(
            testRunID = testRun.externalID,
            testRunNumber = testRun.testRunNumber,
            title = testRun.title,
            status = testRun.status,
            creationDate = testRun.creationDate,
            createdBy = testRun.createdBy?.displayName,
            totalCount = testCaseRuns.size,
            resultCounts = TestCaseRunStatus.entries.associateWith { status -> testCaseRuns.count { it.status == status } },
        )
    }

    private fun runsWithResults(project: WorkspaceProject): List<Pair<TestRun, List<TestCaseRun>>> {
        return testRunRepository.findAllByProject(project)
            .sortedBy { it.testRunNumber }
            .map { it to testCaseRunRepository.findAllByTestRun(it) }
    }

    private fun results(build: ProjectBuildDTO?, runs: List<Pair<TestRun, List<TestCaseRun>>>): BuildResultsDTO {
        val timeline = timeline(runs)
        return BuildResultsDTO(
            build = build,
            counts = timeline.lastOrNull()?.counts ?: counts(emptySet(), emptyMap()),
            // newest first, like the test runs list
            testRuns = runs.reversed().map { (testRun, testCaseRuns) -> summary(testRun, testCaseRuns) },
            timeline = timeline,
            timeSeconds = time(runs.map { it.first }),
        )
    }

    /**
     * One point per test run, in the order they were created, with the latest executed result of each test case
     * in that test run and the ones before it. A pending test case doesn't hide an earlier result.
     */
    private fun timeline(runs: List<Pair<TestRun, List<TestCaseRun>>>): List<BuildTimelinePointDTO> {
        val testCaseIDs = mutableSetOf<Long>()
        val latestResults = mutableMapOf<Long, TestCaseRunStatus>()
        return runs.map { (testRun, testCaseRuns) ->
            for (testCaseRun in testCaseRuns) {
                testCaseIDs.add(testCaseRun.testCase.id)
                if (testCaseRun.status != TestCaseRunStatus.PENDING) {
                    latestResults[testCaseRun.testCase.id] = testCaseRun.status
                }
            }
            BuildTimelinePointDTO(testRun.externalID, testRun.testRunNumber, testRun.title, testRun.creationDate, counts(testCaseIDs, latestResults))
        }
    }

    private fun counts(testCaseIDs: Set<Long>, latestResults: Map<Long, TestCaseRunStatus>): BuildResultCountsDTO {
        val passed = latestResults.values.count { it == TestCaseRunStatus.PASS }
        val failed = latestResults.values.count { it == TestCaseRunStatus.FAIL }
        val skipped = latestResults.values.count { it == TestCaseRunStatus.SKIP }
        val blocked = latestResults.values.count { it == TestCaseRunStatus.BLOCKED }
        val executed = passed + failed + skipped + blocked
        return BuildResultCountsDTO(
            testCaseCount = testCaseIDs.size,
            passed = passed,
            failed = failed,
            skipped = skipped,
            blocked = blocked,
            pending = testCaseIDs.size - executed,
            passRate = if (executed == 0) null else passed.toDouble() / executed,
            failRate = if (executed == 0) null else failed.toDouble() / executed,
        )
    }
}
