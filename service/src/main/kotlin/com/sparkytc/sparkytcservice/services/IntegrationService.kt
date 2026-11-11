package com.sparkytc.sparkytcservice.services

import com.sparkytc.sparkytcservice.auth.CurrentIntegrationProject
import com.sparkytc.sparkytcservice.dto.integration.*
import com.sparkytc.sparkytcservice.dto.testruns.TestCaseRunStatus
import com.sparkytc.sparkytcservice.models.ProjectBuild
import com.sparkytc.sparkytcservice.models.TestCase
import com.sparkytc.sparkytcservice.models.TestCaseRun
import com.sparkytc.sparkytcservice.models.TestCaseSection
import com.sparkytc.sparkytcservice.models.TestPlan
import com.sparkytc.sparkytcservice.models.WorkspaceProject
import com.sparkytc.sparkytcservice.repositories.*
import jakarta.transaction.Transactional
import org.springframework.stereotype.Service
import java.util.UUID

/**
 * What other apps (co-bord) read of one project: its sections, test cases and plans, and the latest result of
 * each test case in a build. The project comes from the API token. Creating is in IntegrationWriteService.
 */
@Service
class IntegrationService(
    private val projectRepository: WorkspaceProjectRepository,
    private val projectBuildRepository: ProjectBuildRepository,
    private val sectionRepository: TestCaseSectionRepository,
    private val testCaseRepository: TestCaseRepository,
    private val testPlanRepository: TestPlanRepository,
    private val testRunRepository: TestRunRepository,
    private val buildResultsService: BuildResultsService,
    private val testCaseResultRepository: TestCaseResultRepository,
    private val testCaseRunRepository: TestCaseRunRepository,
) {
    private fun project(): WorkspaceProject = projectRepository.findById(CurrentIntegrationProject.get()).orElseThrow()

    @Transactional
    fun retrieveProject(): IntegrationProjectDTO {
        val project = project()
        val builds = projectBuildRepository.findAllByProjectOrderByIdDesc(project).map { it.toIntegration() }
        val permissions = if (CurrentIntegrationProject.token().canWrite) listOf("read", "write") else listOf("read")
        return IntegrationProjectDTO(project.projectShortCode, project.title, builds.firstOrNull(), builds, "/projects/${project.projectShortCode}", permissions)
    }

    @Transactional
    fun retrieveSections(): List<IntegrationSectionDTO> {
        val project = project()
        val tree = SectionTree(sectionRepository.findAllByProjectOrderByPositionAscIdAsc(project))
        val testCases = testCaseRepository.findByProjectAndIsArchivedFalseOrderByTestCaseNumberAsc(project)
        return tree.ordered().map { section ->
            val ids = tree.withDescendants(section.id)
            IntegrationSectionDTO(
                sectionID = section.externalID,
                parentID = section.parent?.externalID,
                name = section.name,
                path = tree.path(section),
                testCaseCount = testCases.count { it.section?.id in ids },
                webPath = sectionPath(project, section),
            )
        }
    }

    /** Test cases matching `query` in their number or title (all of them without a query), up to `limit`. */
    @Transactional
    fun retrieveTestCases(query: String?, limit: Int): List<IntegrationTestCaseDTO> {
        val project = project()
        val tree = SectionTree(sectionRepository.findAllByProjectOrderByPositionAscIdAsc(project))
        val text = query?.trim()?.removePrefix("#")?.lowercase().orEmpty()
        return testCaseRepository.findByProjectAndIsArchivedFalseOrderByTestCaseNumberAsc(project)
            .filter { text.isEmpty() || it.testCaseNumber.toString() == text || it.title.lowercase().contains(text) }
            .take(limit.coerceIn(1, 500))
            .map { toIntegration(project, tree, it) }
    }

    /** One test case of the token's project, as the API lists them. */
    @Transactional
    fun retrieveTestCase(testCaseID: Long, created: Boolean? = null): IntegrationTestCaseDTO {
        val project = project()
        val tree = SectionTree(sectionRepository.findAllByProjectOrderByPositionAscIdAsc(project))
        return toIntegration(project, tree, testCaseRepository.findById(testCaseID).orElseThrow()).copy(created = created)
    }

    /** One section of the token's project, as the API lists them. */
    @Transactional
    fun retrieveSection(sectionID: UUID): IntegrationSectionDTO = retrieveSections().first { it.sectionID == sectionID }

    /** One test plan of the token's project, as the API lists them. */
    @Transactional
    fun retrieveTestPlan(testPlanID: UUID, created: Boolean? = null): IntegrationTestPlanDTO =
        retrieveTestPlans().first { it.testPlanID == testPlanID }.copy(created = created)

    /** The test cases a plan takes now (not archived), with the same rule as the app; for creating test runs. */
    fun testCasesOfPlan(project: WorkspaceProject, plan: TestPlan): List<TestCase> {
        val tree = SectionTree(sectionRepository.findAllByProjectOrderByPositionAscIdAsc(project))
        return planTestCases(plan, testCaseRepository.findByProjectAndIsArchivedFalseOrderByTestCaseNumberAsc(project), tree)
    }

    /** A test run of the token's project, with its test cases in number order. */
    @Transactional
    fun retrieveTestRun(testRunID: Long, created: Boolean? = null): IntegrationTestRunDTO {
        val project = project()
        val run = testRunRepository.findById(testRunID).orElseThrow()
        require(run.project.id == project.id) { "No test run found" }
        val runPath = "/test-runs/${project.projectShortCode}/${run.testRunNumber}"
        val testCases = testCaseRunRepository.findAllByTestRun(run)
            .sortedBy { it.testCase.testCaseNumber }
            .map { caseRun ->
                IntegrationTestRunCaseDTO(
                    testCaseNumber = caseRun.testCase.testCaseNumber,
                    title = caseRun.title,
                    status = status(caseRun.status),
                    webPath = "$runPath/${caseRun.testCase.testCaseNumber}",
                )
            }
        return IntegrationTestRunDTO(
            testRunID = run.externalID,
            testRunNumber = run.testRunNumber,
            title = run.title,
            status = run.status.name,
            build = run.build?.toIntegration(),
            automated = run.isAutomated,
            testPlanID = run.testPlan?.externalID,
            testCases = testCases,
            webPath = runPath,
            sourceRef = run.sourceRef,
            created = created,
        )
    }

    private fun toIntegration(project: WorkspaceProject, tree: SectionTree, testCase: TestCase) = IntegrationTestCaseDTO(
        testCaseID = testCase.externalID,
        testCaseNumber = testCase.testCaseNumber,
        title = testCase.title,
        sectionPath = testCase.section?.let { tree.path(it) },
        labels = testCase.labels.sortedBy { it.lowercase() },
        webPath = testCasePath(project, testCase),
        sourceRef = testCase.sourceRef,
    )

    @Transactional
    fun retrieveTestPlans(): List<IntegrationTestPlanDTO> {
        val project = project()
        val tree = SectionTree(sectionRepository.findAllByProjectOrderByPositionAscIdAsc(project))
        val testCases = testCaseRepository.findByProjectAndIsArchivedFalseOrderByTestCaseNumberAsc(project)
        return testPlanRepository.findAllByProjectOrderByNameAsc(project).map { plan ->
            IntegrationTestPlanDTO(plan.externalID, plan.name, plan.description, planTestCases(plan, testCases, tree).size, planPath(project, plan), plan.sourceRef)
        }
    }

    @Transactional
    fun retrieveResults(request: IntegrationResultsRequestDTO): IntegrationResultsDTO {
        val project = project()
        val build = request.build?.trim()?.takeIf { it.isNotEmpty() }?.let { number ->
            requireNotNull(projectBuildRepository.findByProjectAndBuildNumberIgnoreCase(project, number)) { "No build $number found" }
        } ?: projectBuildRepository.findTopByProjectOrderByIdDesc(project)

        val tree = SectionTree(sectionRepository.findAllByProjectOrderByPositionAscIdAsc(project))
        val testCases = testCaseRepository.findByProjectAndIsArchivedFalseOrderByTestCaseNumberAsc(project)
        val latest = latestResults(project, build)

        val byNumber = testCases.associateBy { it.testCaseNumber }
        val wantedNumbers = request.testCaseNumbers.orEmpty().distinct()
        val caseResults = wantedNumbers.mapNotNull { number -> byNumber[number]?.let { result(project, it, latest[it.id]) } }

        val sectionsByID = tree.sections.associateBy { it.externalID }
        val wantedSections = request.sectionIDs.orEmpty().distinct()
        val sectionResults = wantedSections.mapNotNull { id ->
            val section = sectionsByID[id] ?: return@mapNotNull null
            val ids = tree.withDescendants(section.id)
            group(section.externalID, tree.path(section), testCases.filter { it.section?.id in ids }, latest, sectionPath(project, section))
        }

        val plans = testPlanRepository.findAllByProjectOrderByNameAsc(project).associateBy { it.externalID }
        val wantedPlans = request.testPlanIDs.orEmpty().distinct()
        val planResults = wantedPlans.mapNotNull { id ->
            val plan = plans[id] ?: return@mapNotNull null
            group(plan.externalID, plan.name, planTestCases(plan, testCases, tree), latest, planPath(project, plan))
        }

        return IntegrationResultsDTO(
            build = build?.toIntegration(),
            testCases = caseResults,
            sections = sectionResults,
            testPlans = planResults,
            missingTestCaseNumbers = wantedNumbers.filter { it !in byNumber },
            missingSectionIDs = wantedSections.filter { it !in sectionsByID },
            missingTestPlanIDs = wantedPlans.filter { it !in plans },
        )
    }

    /**
     * A test case of the token's project by its number, archived ones included, with its steps and up to `limit` of
     * its results, newest first; null when there's no such test case.
     */
    @Transactional
    fun retrieveHistory(testCaseNumber: Long, limit: Int): IntegrationTestCaseHistoryDTO? {
        val project = project()
        val testCase = testCaseRepository.findByProjectAndTestCaseNumber(project, testCaseNumber) ?: return null
        val tree = SectionTree(sectionRepository.findAllByProjectOrderByPositionAscIdAsc(project))
        val results = testCaseResultRepository.findAllByTestCaseRunTestCaseOrderByRecordedAtDescIdDesc(testCase)
        val latestByRun = results.groupBy { it.testCaseRun.id }.mapValues { (_, runResults) -> runResults.first().id }
        val steps = testCase.steps.sortedBy { it.position }.flatMap { step ->
            val shared = step.sharedStep
            if (shared != null) shared.items.sortedBy { it.position }.map { IntegrationTestStepDTO(it.action, it.expected, shared.name) }
            else listOf(IntegrationTestStepDTO(step.action.orEmpty(), step.expected))
        }
        return IntegrationTestCaseHistoryDTO(
            testCase = toIntegration(project, tree, testCase),
            description = testCase.description,
            testInstructions = testCase.testInstructions,
            format = testCase.format.name,
            steps = steps,
            archived = testCase.isArchived,
            total = results.size,
            results = results.take(limit.coerceIn(1, 200)).map { result ->
                val run = result.testCaseRun.testRun
                IntegrationHistoryEntryDTO(
                    status = status(result.status),
                    notes = result.notes,
                    recordedBy = result.recordedBy?.displayName,
                    recordedAt = result.recordedAt,
                    testRunNumber = run.testRunNumber,
                    testRunTitle = run.title,
                    buildNumber = run.build?.buildNumber,
                    isLatestInRun = latestByRun[result.testCaseRun.id] == result.id,
                    steps = result.stepResults.sortedBy { it.step.position }.map {
                        IntegrationStepResultDTO(it.step.action, it.step.expected, it.status?.let(::status), it.actual)
                    },
                    evidenceCount = result.attachments.size,
                    webPath = "/test-runs/${project.projectShortCode}/${run.testRunNumber}/${testCase.testCaseNumber}",
                )
            },
        )
    }

    /**
     * The latest executed result of each test case among the build's test runs, by test case id; like the
     * build results, a later pending test case doesn't hide an earlier result. Without builds, every run counts.
     */
    private fun latestResults(project: WorkspaceProject, build: ProjectBuild?): Map<Long, TestCaseRun> {
        val runs = testRunRepository.findAllByProject(project)
            .filter { build == null || it.build?.id == build.id }
            .sortedBy { it.testRunNumber }
        val byRun = buildResultsService.testCaseRunsByRun(runs)
        val latest = mutableMapOf<Long, TestCaseRun>()
        for (run in runs) {
            for (testCaseRun in byRun[run.id].orEmpty()) {
                if (testCaseRun.status != TestCaseRunStatus.PENDING) latest[testCaseRun.testCase.id] = testCaseRun
            }
        }
        return latest
    }

    private fun result(project: WorkspaceProject, testCase: TestCase, run: TestCaseRun?) = IntegrationTestCaseResultDTO(
        testCaseNumber = testCase.testCaseNumber,
        title = testCase.title,
        status = status(run),
        executedAt = run?.executedAt,
        executedBy = run?.executedBy?.displayName,
        testRunNumber = run?.testRun?.testRunNumber,
        webPath = testCasePath(project, testCase),
    )

    private fun group(id: UUID, name: String, testCases: List<TestCase>, latest: Map<Long, TestCaseRun>, webPath: String): IntegrationGroupResultDTO {
        val statuses = testCases.map { status(latest[it.id]) }
        val counts = IntegrationCountsDTO(
            total = statuses.size,
            passed = statuses.count { it == IntegrationResultStatus.PASS },
            failed = statuses.count { it == IntegrationResultStatus.FAIL },
            blocked = statuses.count { it == IntegrationResultStatus.BLOCKED },
            skipped = statuses.count { it == IntegrationResultStatus.SKIP },
            notRun = statuses.count { it == IntegrationResultStatus.NOT_RUN },
        )
        val summary = when {
            statuses.isEmpty() -> null
            counts.failed > 0 -> IntegrationResultStatus.FAIL
            counts.blocked > 0 -> IntegrationResultStatus.BLOCKED
            counts.notRun > 0 -> IntegrationResultStatus.NOT_RUN
            counts.passed > 0 -> IntegrationResultStatus.PASS
            else -> IntegrationResultStatus.SKIP
        }
        return IntegrationGroupResultDTO(id, name, counts, summary, webPath)
    }

    private fun status(run: TestCaseRun?): IntegrationResultStatus = status(run?.status)

    private fun status(value: TestCaseRunStatus?): IntegrationResultStatus = when (value) {
        TestCaseRunStatus.PASS -> IntegrationResultStatus.PASS
        TestCaseRunStatus.FAIL -> IntegrationResultStatus.FAIL
        TestCaseRunStatus.BLOCKED -> IntegrationResultStatus.BLOCKED
        TestCaseRunStatus.SKIP -> IntegrationResultStatus.SKIP
        else -> IntegrationResultStatus.NOT_RUN
    }

    /** Same rule as the client's planTestCases: its sections (and nested ones), any of its labels, or chosen. */
    private fun planTestCases(plan: TestPlan, testCases: List<TestCase>, tree: SectionTree): List<TestCase> {
        val sectionIDs = plan.sections.flatMap { tree.withDescendants(it.id) }.toSet()
        val labels = plan.labels.map { it.lowercase() }.toSet()
        val chosen = plan.testCases.map { it.id }.toSet()
        return testCases.filter { testCase ->
            testCase.section?.id in sectionIDs || testCase.labels.any { it.lowercase() in labels } || testCase.id in chosen
        }
    }

    private fun ProjectBuild.toIntegration() = IntegrationBuildDTO(externalID, buildNumber)

    private fun testCasePath(project: WorkspaceProject, testCase: TestCase) = "/test-cases/${project.projectShortCode}/${testCase.testCaseNumber}"
    private fun sectionPath(project: WorkspaceProject, section: TestCaseSection) = "/test-cases/${project.projectShortCode}?section=${section.externalID}"
    private fun planPath(project: WorkspaceProject, plan: TestPlan) = "/test-plans/${project.projectShortCode}/${plan.externalID}"

    /** A project's sections, with their nesting resolved once. */
    private class SectionTree(val sections: List<TestCaseSection>) {
        private val children = sections.groupBy { it.parent?.id }

        fun withDescendants(id: Long): Set<Long> {
            val result = mutableSetOf<Long>()
            val pending = ArrayDeque(listOf(id))
            while (pending.isNotEmpty()) {
                val next = pending.removeFirst()
                if (result.add(next)) children[next].orEmpty().forEach { pending.add(it.id) }
            }
            return result
        }

        fun path(section: TestCaseSection): String {
            val names = mutableListOf<String>()
            var current: TestCaseSection? = section
            var guard = 0
            while (current != null && guard++ < 50) {
                names.add(current.name)
                current = current.parent
            }
            return names.reversed().joinToString(" / ")
        }

        /** Suites and their sections depth first, in their order. */
        fun ordered(): List<TestCaseSection> {
            val out = mutableListOf<TestCaseSection>()
            fun visit(parentID: Long?) {
                for (section in children[parentID].orEmpty().sortedWith(compareBy({ it.position }, { it.id }))) {
                    out.add(section)
                    visit(section.id)
                }
            }
            visit(null)
            return out
        }
    }
}
