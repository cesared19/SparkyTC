package com.sparkytc.sparkytcservice.services

import com.sparkytc.sparkytcservice.dto.steps.SaveSharedStepDTO
import com.sparkytc.sparkytcservice.dto.steps.SharedStepDTO
import com.sparkytc.sparkytcservice.dto.steps.StepInputDTO
import com.sparkytc.sparkytcservice.dto.steps.StepResultDTO
import com.sparkytc.sparkytcservice.dto.steps.TestCaseFormat
import com.sparkytc.sparkytcservice.dto.testruns.TestCaseRunStatus
import com.sparkytc.sparkytcservice.models.SharedStep
import com.sparkytc.sparkytcservice.models.SharedStepItem
import com.sparkytc.sparkytcservice.models.TestCase
import com.sparkytc.sparkytcservice.models.TestCaseResult
import com.sparkytc.sparkytcservice.models.TestCaseResultStep
import com.sparkytc.sparkytcservice.models.TestCaseRun
import com.sparkytc.sparkytcservice.models.TestCaseRunStep
import com.sparkytc.sparkytcservice.models.TestCaseStep
import com.sparkytc.sparkytcservice.models.WorkspaceProject
import com.sparkytc.sparkytcservice.repositories.SharedStepItemRepository
import com.sparkytc.sparkytcservice.repositories.SharedStepRepository
import com.sparkytc.sparkytcservice.repositories.TestCaseResultStepRepository
import com.sparkytc.sparkytcservice.repositories.TestCaseRunStepRepository
import com.sparkytc.sparkytcservice.repositories.TestCaseStepRepository
import com.sparkytc.sparkytcservice.repositories.WorkspaceProjectRepository
import jakarta.transaction.Transactional
import org.springframework.stereotype.Service
import java.util.UUID

/**
 * Test cases written as steps, each with its expected result. Steps can be shared between test cases; runs keep
 * their own copy, with shared steps expanded, and each result records how every step went.
 */
@Service
class StepService(
    private val stepRepository: TestCaseStepRepository,
    private val sharedStepRepository: SharedStepRepository,
    private val sharedStepItemRepository: SharedStepItemRepository,
    private val runStepRepository: TestCaseRunStepRepository,
    private val resultStepRepository: TestCaseResultStepRepository,
    private val projectRepository: WorkspaceProjectRepository,
    private val projectAccessService: ProjectAccessService,
) {
    /** Sets the format and replaces the steps of a test case; null leaves each as it is. */
    fun saveSteps(testCase: TestCase, format: TestCaseFormat?, steps: List<StepInputDTO>?) {
        if (format != null) testCase.format = format
        if (steps != null) {
            require(steps.size <= MAX_STEPS) { "A test case can have at most $MAX_STEPS steps" }
            stepRepository.deleteAllByTestCase(testCase)
            stepRepository.flush()
            steps.forEachIndexed { index, input ->
                val step = if (input.sharedStepID != null) {
                    TestCaseStep(testCase = testCase, position = index, sharedStep = requireSharedStep(testCase.project, input.sharedStepID))
                } else {
                    val action = clean(input.action)
                    requireNotNull(action) { "Step ${index + 1} needs an action" }
                    TestCaseStep(testCase = testCase, position = index, action = action, expected = clean(input.expected))
                }
                stepRepository.save(step)
            }
        }
        if (testCase.format == TestCaseFormat.STEPS) {
            require(stepRepository.findAllByTestCaseOrderByPositionAsc(testCase).isNotEmpty()) { "Add at least one step" }
        }
    }

    /**
     * Switches a test case between text and steps without losing its content: a test case without steps gets its
     * instructions (or its title) as the first step, and one without instructions gets its steps as numbered text.
     */
    fun convertFormat(testCase: TestCase, format: TestCaseFormat) {
        if (testCase.format == format) return
        val steps = stepRepository.findAllByTestCaseOrderByPositionAsc(testCase)
        if (format == TestCaseFormat.STEPS && steps.isEmpty()) {
            val action = clean(testCase.testInstructions) ?: testCase.title
            stepRepository.save(TestCaseStep(testCase = testCase, position = 0, action = action))
        }
        if (format == TestCaseFormat.TEXT && clean(testCase.testInstructions) == null) {
            val lines = steps.flatMap { step ->
                step.sharedStep?.items?.map { it.action to it.expected } ?: listOf((step.action ?: "") to step.expected)
            }
            testCase.testInstructions = lines.mapIndexed { index, (action, expected) ->
                "${index + 1}. $action" + (expected?.let { "\n   Expected: $it" } ?: "")
            }.joinToString("\n").takeIf { it.isNotEmpty() }
        }
        testCase.format = format
    }

    /** Copies the format and steps of the test case into a new test run, expanding shared steps. */
    fun copyToRun(testCase: TestCase, testCaseRun: TestCaseRun) {
        testCaseRun.format = testCase.format
        if (testCase.format != TestCaseFormat.STEPS) return
        var position = 0
        for (step in stepRepository.findAllByTestCaseOrderByPositionAsc(testCase)) {
            val shared = step.sharedStep
            if (shared == null) {
                runStepRepository.save(TestCaseRunStep(testCaseRun = testCaseRun, position = position++, action = step.action ?: "", expected = step.expected))
            } else {
                for (item in shared.items) {
                    runStepRepository.save(TestCaseRunStep(testCaseRun = testCaseRun, position = position++, action = item.action, expected = item.expected, sharedStepName = shared.name))
                }
            }
        }
    }

    /** Keeps how each step of the run went in this result. */
    fun recordStepResults(result: TestCaseResult, testCaseRun: TestCaseRun, stepResults: List<StepResultDTO>) {
        if (stepResults.isEmpty()) return
        val steps = runStepRepository.findAllByTestCaseRunOrderByPositionAsc(testCaseRun).associateBy { it.externalID }
        for (input in stepResults.distinctBy { it.stepID }) {
            val step = steps[input.stepID]
            requireNotNull(step) { "No step found with id ${input.stepID} in this test case" }
            require(input.status != TestCaseRunStatus.PENDING) { "A step is marked as pass, fail, blocked or skip, or left empty" }
            val actual = clean(input.actual)
            if (input.status == null && actual == null) continue
            resultStepRepository.save(TestCaseResultStep(result = result, step = step, status = input.status, actual = actual))
        }
    }

    /** The steps of a run as numbered text, e.g. for the steps to reproduce of a Jira issue. */
    fun stepsText(testCaseRun: TestCaseRun): String? {
        if (testCaseRun.format != TestCaseFormat.STEPS) return null
        val steps = runStepRepository.findAllByTestCaseRunOrderByPositionAsc(testCaseRun)
        if (steps.isEmpty()) return null
        return steps.mapIndexed { index, step ->
            "${index + 1}. ${step.action}" + (step.expected?.let { "\n   Expected: $it" } ?: "")
        }.joinToString("\n")
    }

    @Transactional
    fun retrieveSharedSteps(projectShortCode: String): List<SharedStepDTO> {
        val project = accessibleProject(projectShortCode)
        return sharedStepRepository.findAllByProjectOrderByNameAsc(project).map { it.toDTO(stepRepository.countBySharedStep(it).toInt()) }
    }

    @Transactional
    fun createSharedStep(projectShortCode: String, request: SaveSharedStepDTO): SharedStepDTO {
        val project = accessibleProject(projectShortCode)
        val sharedStep = sharedStepRepository.save(SharedStep(project = project, name = requireName(request.name)))
        saveItems(sharedStep, request)
        return SharedStepDTO(sharedStep.externalID, sharedStep.name, cleanItems(request))
    }

    /** Edits a shared step; the test cases that use it change too, test runs already created keep their copy. */
    @Transactional
    fun updateSharedStep(sharedStepID: UUID, request: SaveSharedStepDTO): SharedStepDTO {
        val sharedStep = accessibleSharedStep(sharedStepID)
        sharedStep.name = requireName(request.name)
        sharedStepRepository.save(sharedStep)
        sharedStepItemRepository.deleteAllBySharedStep(sharedStep)
        sharedStepItemRepository.flush()
        saveItems(sharedStep, request)
        return SharedStepDTO(sharedStep.externalID, sharedStep.name, cleanItems(request), stepRepository.countBySharedStep(sharedStep).toInt())
    }

    @Transactional
    fun deleteSharedStep(sharedStepID: UUID) {
        val sharedStep = accessibleSharedStep(sharedStepID)
        val usage = stepRepository.countBySharedStep(sharedStep)
        require(usage == 0L) { "${sharedStep.name} is used by $usage test case${if (usage == 1L) "" else "s"}, remove it from them first" }
        sharedStepRepository.delete(sharedStep)
    }

    private fun saveItems(sharedStep: SharedStep, request: SaveSharedStepDTO) {
        cleanItems(request).forEachIndexed { index, item ->
            sharedStepItemRepository.save(SharedStepItem(sharedStep = sharedStep, position = index, action = item.action, expected = item.expected))
        }
    }

    private fun cleanItems(request: SaveSharedStepDTO) = request.items.mapIndexed { index, item ->
        val action = clean(item.action)
        requireNotNull(action) { "Step ${index + 1} needs an action" }
        item.copy(action = action, expected = clean(item.expected))
    }.also {
        require(it.isNotEmpty()) { "A shared step needs at least one step" }
        require(it.size <= MAX_STEPS) { "A shared step can have at most $MAX_STEPS steps" }
    }

    private fun requireSharedStep(project: WorkspaceProject, sharedStepID: UUID): SharedStep {
        val sharedStep = sharedStepRepository.findByExternalID(sharedStepID)
        require(sharedStep != null && sharedStep.project.id == project.id) { "No shared step found with id $sharedStepID" }
        return sharedStep
    }

    private fun accessibleSharedStep(sharedStepID: UUID): SharedStep {
        val sharedStep = sharedStepRepository.findByExternalID(sharedStepID)
        requireNotNull(sharedStep) { "No shared step found with id $sharedStepID" }
        projectAccessService.requireAccess(sharedStep.project)
        return sharedStep
    }

    private fun accessibleProject(projectShortCode: String): WorkspaceProject {
        val project = projectRepository.findByProjectShortCode(projectShortCode)
        requireNotNull(project) { "No project found for id $projectShortCode" }
        projectAccessService.requireAccess(project)
        return project
    }

    private fun requireName(name: String): String {
        val trimmed = name.trim()
        require(trimmed.isNotEmpty()) { "The shared step needs a name" }
        require(trimmed.length <= 200) { "The name must be at most 200 characters" }
        return trimmed
    }

    private fun clean(text: String?) = text?.trim()?.takeIf { it.isNotEmpty() }

    companion object {
        const val MAX_STEPS = 200
    }
}
