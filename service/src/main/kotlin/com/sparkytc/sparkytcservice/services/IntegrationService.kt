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
 * Read-only view of one project for other apps (co-bord): its sections, test cases and plans, and the latest
 * result of each test case in a build. The project comes from the API token.
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
) {
    private fun project(): WorkspaceProject = projectRepository.findById(CurrentIntegrationProject.get()).orElseThrow()

    @Transactional
    fun retrieveProject(): IntegrationProjectDTO {
        val project = project()
        val builds = projectBuildRepository.findAllByProjectOrderByIdDesc(project).map { it.toIntegration() }
        return IntegrationProjectDTO(project.projectShortCode, project.title, builds.firstOrNull(), builds, "/projects/${project.projectShortCode}")
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
            .map { testCase ->
                IntegrationTestCaseDTO(
                    testCaseID = testCase.externalID,
                    testCaseNumber = testCase.testCaseNumber,
                    title = testCase.title,
                    sectionPath = testCase.section?.let { tree.path(it) },
                    labels = testCase.labels.sortedBy { it.lowercase() },
                    webPath = testCasePath(project, testCase),
                )
            }
    }

    @Transactional
    fun retrieveTestPlans(): List<IntegrationTestPlanDTO> {
        val project = project()
        val tree = SectionTree(sectionRepository.findAllByProjectOrderByPositionAscIdAsc(project))
        val testCases = testCaseRepository.findByProjectAndIsArchivedFalseOrderByTestCaseNumberAsc(project)
        return testPlanRepository.findAllByProjectOrderByNameAsc(project).map { plan ->
            IntegrationTestPlanDTO(plan.externalID, plan.name, plan.description, planTestCases(plan, testCases, tree).size, planPath(project, plan))
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

    private fun status(run: TestCaseRun?): IntegrationResultStatus = when (run?.status) {
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
