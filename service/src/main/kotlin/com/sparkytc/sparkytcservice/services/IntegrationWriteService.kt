package com.sparkytc.sparkytcservice.services

import com.sparkytc.sparkytcservice.auth.CurrentIntegrationProject
import com.sparkytc.sparkytcservice.dto.integration.*
import com.sparkytc.sparkytcservice.dto.plans.SaveTestPlanDTO
import com.sparkytc.sparkytcservice.dto.steps.StepInputDTO
import com.sparkytc.sparkytcservice.dto.steps.TestCaseFormat
import com.sparkytc.sparkytcservice.dto.testcases.CreateTestCaseDTO
import com.sparkytc.sparkytcservice.dto.testruns.TestCaseRunStatus
import com.sparkytc.sparkytcservice.models.ProjectApiToken
import com.sparkytc.sparkytcservice.models.WorkspaceProject
import com.sparkytc.sparkytcservice.repositories.*
import org.springframework.dao.DataIntegrityViolationException
import org.springframework.stereotype.Service
import org.springframework.transaction.PlatformTransactionManager
import org.springframework.transaction.support.TransactionTemplate

/**
 * What other apps create in a project through the integration API, with a token that can write: sections, test
 * cases and test plans. Nothing is ever edited or deleted from the API. What's created is credited to the token,
 * and a sourceRef makes creating it twice return the first one.
 */
@Service
class IntegrationWriteService(
    private val projectRepository: WorkspaceProjectRepository,
    private val tokenRepository: ProjectApiTokenRepository,
    private val propertyConfigurationRepository: PropertyConfigurationRepository,
    private val testCaseRepository: TestCaseRepository,
    private val testPlanRepository: TestPlanRepository,
    private val testRunRepository: TestRunRepository,
    private val projectBuildRepository: ProjectBuildRepository,
    private val testCaseRunRepository: TestCaseRunRepository,
    private val objectMapper: com.fasterxml.jackson.databind.ObjectMapper,
    private val sectionService: TestCaseSectionService,
    private val workspaceService: WorkspaceService,
    private val testPlanService: TestPlanService,
    private val integrationService: IntegrationService,
    transactionManager: PlatformTransactionManager,
) {
    private val transaction = TransactionTemplate(transactionManager)

    fun createSection(request: IntegrationCreateSectionDTO): IntegrationSectionDTO {
        val path = request.path?.trim().orEmpty()
        require(path.isNotEmpty()) { "Send the section path, e.g. \"Checkout / Payments\"" }
        val sectionID = transaction.execute {
            val (project, token) = projectAndToken()
            sectionService.sectionForPath(project, path, token).externalID
        }!!
        return integrationService.retrieveSection(sectionID)
    }

    fun createTestCase(request: IntegrationCreateTestCaseDTO): IntegrationTestCaseDTO {
        val title = request.title?.trim().orEmpty()
        require(title.isNotEmpty()) { "Give the test case a title" }
        require(title.length <= MAX_TITLE) { "The title can have up to $MAX_TITLE characters" }
        val steps = request.steps.orEmpty()
        val format = when (request.format?.trim()?.uppercase()) {
            null, "" -> if (steps.isEmpty()) TestCaseFormat.TEXT else TestCaseFormat.STEPS
            "TEXT" -> TestCaseFormat.TEXT
            "STEPS" -> TestCaseFormat.STEPS
            else -> throw IllegalArgumentException("The format must be TEXT or STEPS")
        }
        require(format == TestCaseFormat.STEPS || steps.isEmpty()) {
            "Steps are for test cases in the STEPS format: send \"format\": \"STEPS\" or leave the steps out"
        }
        val sourceRef = sourceRef(request.sourceRef)

        val (testCaseID, created) = createOnce(
            existing = { project -> sourceRef?.let { testCaseRepository.findByProjectAndSourceRefAndIsArchivedFalse(project, it) }?.id },
            create = { project, token ->
                val testCase = CreateTestCaseDTO(
                    title = title,
                    description = request.description,
                    testInstructions = request.testInstructions,
                    propertyValues = defaultPropertyValues(),
                    sectionPath = request.sectionPath,
                    labels = request.labels.orEmpty(),
                    format = format,
                    steps = steps.map { StepInputDTO(action = it.action, expected = it.expected) },
                )
                workspaceService.createTestCaseByToken(project, testCase, token, sourceRef).id
            },
        )
        return integrationService.retrieveTestCase(testCaseID, created)
    }

    fun createTestPlan(request: IntegrationCreateTestPlanDTO): IntegrationTestPlanDTO {
        // the name first, like the app; the plan's other rules are checked by TestPlanService
        require(!request.name.isNullOrBlank()) { "The test plan needs a name" }
        val sourceRef = sourceRef(request.sourceRef)
        val (testPlanID, created) = createOnce(
            existing = { project -> sourceRef?.let { testPlanRepository.findByProjectAndSourceRef(project, it) }?.id },
            create = { project, token ->
                // test cases are chosen by number, like the rest of the API
                val byNumber = testCaseRepository.findByProjectAndIsArchivedFalseOrderByTestCaseNumberAsc(project)
                    .associateBy { it.testCaseNumber }
                val testCaseIDs = request.testCaseNumbers.orEmpty().distinct().map { number ->
                    requireNotNull(byNumber[number]) { "No test case #$number in this project" }.externalID
                }
                val plan = SaveTestPlanDTO(
                    name = request.name.orEmpty(),
                    description = request.description,
                    sectionIDs = request.sectionIDs.orEmpty(),
                    labels = request.labels.orEmpty(),
                    testCaseIDs = testCaseIDs,
                )
                testPlanService.createTestPlanByToken(project, plan, token, sourceRef).id
            },
        )
        val externalID = transaction.execute { testPlanRepository.findById(testPlanID).orElseThrow().externalID }!!
        return integrationService.retrieveTestPlan(externalID, created)
    }

    /**
     * Creates an automated test run for a build that's already registered, with test cases by number and/or a test
     * plan's, or returns the one with the same sourceRef. Nothing is created if something is wrong.
     */
    fun createTestRun(request: IntegrationCreateTestRunDTO): IntegrationTestRunDTO {
        val title = request.title?.trim().orEmpty()
        require(title.isNotEmpty()) { "Give the test run a title" }
        require(title.length <= MAX_TITLE) { "The title can have up to $MAX_TITLE characters" }
        val buildNumber = request.build?.trim().orEmpty()
        require(buildNumber.isNotEmpty()) { "Send the build the test run is for, e.g. \"build\": \"1.4.2\"" }
        val numbers = request.testCaseNumbers.orEmpty().distinct()
        require(numbers.isNotEmpty() || request.testPlanID != null) { "Send testCaseNumbers, a testPlanID, or both" }
        val sourceRef = sourceRef(request.sourceRef)

        val (testRunID, created) = createOnce(
            existing = { project -> sourceRef?.let { testRunRepository.findByProjectAndSourceRef(project, it) }?.id },
            create = { project, token ->
                // builds are registered by admins; the API never creates them
                val build = requireNotNull(projectBuildRepository.findByProjectAndBuildNumberIgnoreCase(project, buildNumber)) {
                    "No build $buildNumber in this project. An admin registers builds in the Builds tab."
                }
                val plan = request.testPlanID?.let { id ->
                    testPlanRepository.findByExternalID(id)?.takeIf { it.project.id == project.id }
                        ?: throw IllegalArgumentException("No test plan $id in this project")
                }

                val byNumber = testCaseRepository.findByProjectAndIsArchivedFalseOrderByTestCaseNumberAsc(project)
                    .associateBy { it.testCaseNumber }
                val missing = numbers.filter { it !in byNumber }
                require(missing.isEmpty()) {
                    "No test case ${missing.joinToString(", ") { "#$it" }} in this project (or archived)"
                }
                val testCases = (numbers.map { byNumber.getValue(it) } + plan?.let { integrationService.testCasesOfPlan(project, it) }.orEmpty())
                    .distinctBy { it.id }
                    .sortedBy { it.testCaseNumber }
                require(testCases.isNotEmpty()) { "The test plan ${plan?.name} has no test cases" }

                workspaceService.createTestRunByToken(project, title, request.description, build, plan, testCases, token, sourceRef).id
            },
        )
        return integrationService.retrieveTestRun(testRunID, created)
    }

    /**
     * Records a result for a test case of an automated test run, like the app does, credited to the token. Returns
     * null when the project has no test run with that number. Results are never edited through the API.
     */
    fun recordResult(testRunNumber: Long, request: IntegrationRecordResultDTO): IntegrationRecordedResultDTO? {
        val testCaseNumber = requireNotNull(request.testCaseNumber) { "Send the testCaseNumber" }
        val status = when (request.status?.trim()?.uppercase()) {
            "PASS" -> TestCaseRunStatus.PASS
            "FAIL" -> TestCaseRunStatus.FAIL
            "BLOCKED" -> TestCaseRunStatus.BLOCKED
            "SKIP" -> TestCaseRunStatus.SKIP
            else -> throw IllegalArgumentException("The status must be PASS, FAIL, BLOCKED or SKIP")
        }
        val notes = request.notes?.trim()?.takeIf { it.isNotEmpty() }
        require(notes == null || notes.length <= MAX_NOTES) { "The notes can have up to $MAX_NOTES characters" }
        val duration = request.durationSeconds
        require(duration == null || duration in 0..MAX_DURATION_SECONDS) { "The durationSeconds must be between 0 and $MAX_DURATION_SECONDS (24 hours)" }
        val report = request.report?.let { reportJson(it) }

        return transaction.execute {
            val (project, token) = projectAndToken()
            val testRun = testRunRepository.findByProjectAndTestRunNumber(project, testRunNumber) ?: return@execute null
            require(testRun.isAutomated) { "Test run $testRunNumber was created in the app; the API records results only in automated test runs" }
            require(!testRun.isClosed) { "Test run $testRunNumber is closed" }
            val testCaseRun = testCaseRunRepository.findAllByTestRun(testRun).firstOrNull { it.testCase.testCaseNumber == testCaseNumber }
            requireNotNull(testCaseRun) { "Test case #$testCaseNumber is not in test run $testRunNumber" }

            val result = workspaceService.recordResultByToken(testCaseRun, status, notes, duration, report, token)
            val runPath = "/test-runs/${project.projectShortCode}/$testRunNumber"
            IntegrationRecordedResultDTO(
                resultID = result.externalID,
                testRunNumber = testRunNumber,
                testCaseNumber = testCaseNumber,
                status = IntegrationResultStatus.valueOf(status.name),
                testRunStatus = testRun.status.name,
                webPath = "$runPath/$testCaseNumber",
            )
        }
    }

    /** Checks the report's size and values and returns it as stored: compact JSON. */
    private fun reportJson(report: IntegrationResultReportDTO): String {
        val findings = report.findings.orEmpty()
        require(findings.size <= MAX_REPORT_ITEMS) { "The report can have up to $MAX_REPORT_ITEMS findings" }
        require(findings.all { it.length <= MAX_FINDING }) { "Each finding can have up to $MAX_FINDING characters" }
        val screenshots = report.screenshots.orEmpty()
        require(screenshots.size <= MAX_REPORT_ITEMS) { "The report can have up to $MAX_REPORT_ITEMS screenshots" }
        for (screenshot in screenshots) {
            val name = screenshot.name?.trim().orEmpty()
            require(name.isNotEmpty() && name.length <= MAX_SCREENSHOT_NAME) { "Each screenshot needs a name of up to $MAX_SCREENSHOT_NAME characters" }
            screenshot.differentPercent?.let { require(it.isFinite() && it in 0.0..100.0) { "differentPercent must be between 0 and 100" } }
        }
        for (set in listOfNotNull(report.metrics?.recorded, report.metrics?.replay)) {
            val values = listOfNotNull(set.averageFps, set.frameTimeP50Ms, set.frameTimeP95Ms, set.frameTimeP99Ms, set.overBudgetPercent,
                set.cpuAvgMs, set.gpuAvgMs, set.usedMemoryPeakMB, set.batteryTemperatureMaxC)
            require(values.all { it.isFinite() }) { "The report's metrics must be numbers" }
            require((set.droppedFrames ?: 0) >= 0) { "droppedFrames can't be negative" }
        }
        val json = objectMapper.writeValueAsString(report.copy(
            findings = findings.map { it.trim() }.filter { it.isNotEmpty() },
            screenshots = screenshots.map { it.copy(name = it.name?.trim()) },
        ))
        require(json.length <= MAX_REPORT_LENGTH) { "The report can be up to ${MAX_REPORT_LENGTH / 1024} KB" }
        return json
    }

    /**
     * Returns what already has the app's reference, or creates it. Two requests with the same reference at once
     * both try to create it; the database lets one through and the other gets the one created.
     */
    private fun createOnce(
        existing: (WorkspaceProject) -> Long?,
        create: (WorkspaceProject, ProjectApiToken) -> Long,
    ): Pair<Long, Boolean> {
        return try {
            transaction.execute {
                val (project, token) = projectAndToken()
                existing(project)?.let { it to false } ?: (create(project, token) to true)
            }!!
        } catch (e: DataIntegrityViolationException) {
            transaction.execute { existing(projectAndToken().first) }?.let { it to false } ?: throw e
        }
    }

    private fun projectAndToken(): Pair<WorkspaceProject, ProjectApiToken> {
        val current = CurrentIntegrationProject.token()
        return projectRepository.findById(current.projectID).orElseThrow() to tokenRepository.findById(current.tokenID).orElseThrow()
    }

    private fun sourceRef(value: String?): String? {
        val sourceRef = value?.trim()?.takeIf { it.isNotEmpty() } ?: return null
        require(sourceRef.length <= MAX_SOURCE_REF) { "The sourceRef can have up to $MAX_SOURCE_REF characters" }
        return sourceRef
    }

    /** Required properties take their default value; one without a default can't be filled from the API. */
    private fun defaultPropertyValues() = propertyConfigurationRepository.findAll()
        .filter { it.isRequired }
        .associate { property ->
            val value = requireNotNull(property.defaultValue?.takeIf { it.isNotBlank() }) {
                "The property ${property.title} is required and has no default value. Give it one in Configuration → Properties."
            }
            property.externalID to value
        }

    companion object {
        // the app has no limit; the API keeps titles to a size a test case list can show
        const val MAX_TITLE = 500
        const val MAX_SOURCE_REF = 200
        const val MAX_NOTES = 10_000
        const val MAX_DURATION_SECONDS = 24L * 60 * 60
        const val MAX_REPORT_ITEMS = 500
        const val MAX_FINDING = 1_000
        const val MAX_SCREENSHOT_NAME = 200
        const val MAX_REPORT_LENGTH = 256 * 1024
    }
}
