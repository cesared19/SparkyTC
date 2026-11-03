package com.sparkytc.sparkytcservice.services

import com.sparkytc.sparkytcservice.auth.CurrentIntegrationProject
import com.sparkytc.sparkytcservice.dto.integration.*
import com.sparkytc.sparkytcservice.dto.plans.SaveTestPlanDTO
import com.sparkytc.sparkytcservice.dto.steps.StepInputDTO
import com.sparkytc.sparkytcservice.dto.steps.TestCaseFormat
import com.sparkytc.sparkytcservice.dto.testcases.CreateTestCaseDTO
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
    }
}
