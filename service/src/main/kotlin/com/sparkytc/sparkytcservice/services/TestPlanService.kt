package com.sparkytc.sparkytcservice.services

import com.sparkytc.sparkytcservice.auth.CurrentUser
import com.sparkytc.sparkytcservice.dto.plans.SaveTestPlanDTO
import com.sparkytc.sparkytcservice.dto.plans.TestPlanDTO
import com.sparkytc.sparkytcservice.models.TestPlan
import com.sparkytc.sparkytcservice.models.WorkspaceProject
import com.sparkytc.sparkytcservice.repositories.TestCaseRepository
import com.sparkytc.sparkytcservice.repositories.TestCaseSectionRepository
import com.sparkytc.sparkytcservice.repositories.TestPlanRepository
import com.sparkytc.sparkytcservice.repositories.WorkspaceProjectRepository
import jakarta.transaction.Transactional
import org.springframework.stereotype.Service
import java.util.UUID

/** Test plans: templates of test cases, chosen by section, label or one by one, to launch test runs from. */
@Service
class TestPlanService(
    private val testPlanRepository: TestPlanRepository,
    private val sectionRepository: TestCaseSectionRepository,
    private val testCaseRepository: TestCaseRepository,
    private val projectRepository: WorkspaceProjectRepository,
    private val projectAccessService: ProjectAccessService,
) {
    @Transactional
    fun retrieveTestPlans(projectShortCode: String): List<TestPlanDTO> {
        return testPlanRepository.findAllByProjectOrderByNameAsc(accessibleProject(projectShortCode)).map { it.toDTO() }
    }

    @Transactional
    fun createTestPlan(projectShortCode: String, request: SaveTestPlanDTO): TestPlanDTO {
        val project = accessibleProject(projectShortCode)
        val plan = TestPlan(project = project, name = "", createdBy = CurrentUser.get())
        apply(plan, request)
        return testPlanRepository.save(plan).toDTO()
    }

    @Transactional
    fun updateTestPlan(testPlanID: UUID, request: SaveTestPlanDTO): TestPlanDTO {
        val plan = accessiblePlan(testPlanID)
        apply(plan, request)
        return testPlanRepository.save(plan).toDTO()
    }

    /** Test runs created from the plan keep their test cases and results. */
    @Transactional
    fun deleteTestPlan(testPlanID: UUID) {
        testPlanRepository.delete(accessiblePlan(testPlanID))
    }

    /** The plan of a new test run, checking it belongs to the run's project. */
    fun requirePlan(project: WorkspaceProject, testPlanID: UUID): TestPlan {
        val plan = testPlanRepository.findByExternalID(testPlanID)
        require(plan != null && plan.project.id == project.id) { "No test plan found with id $testPlanID" }
        return plan
    }

    private fun apply(plan: TestPlan, request: SaveTestPlanDTO) {
        val name = request.name.trim()
        require(name.isNotEmpty()) { "The test plan needs a name" }
        require(name.length <= 200) { "The name must be at most 200 characters" }
        val project = plan.project

        val sections = request.sectionIDs.distinct().map { sectionID ->
            val section = sectionRepository.findByExternalID(sectionID)
            require(section != null && section.project.id == project.id) { "No section found with id $sectionID" }
            section
        }
        val testCases = request.testCaseIDs.distinct().map { testCaseID ->
            val testCase = testCaseRepository.findByExternalID(testCaseID)
            require(testCase != null && testCase.project.id == project.id && !testCase.isArchived) { "No test case found with id $testCaseID" }
            testCase
        }
        // without repeats ignoring case, like the labels of test cases
        val labels = request.labels.map { it.trim() }.filter { it.isNotEmpty() }.distinctBy { it.lowercase() }
        require(sections.isNotEmpty() || labels.isNotEmpty() || testCases.isNotEmpty()) {
            "Choose the test cases of the plan: sections, labels or test cases"
        }

        plan.name = name
        plan.description = request.description?.trim()?.takeIf { it.isNotEmpty() }
        plan.sections = sections.toMutableSet()
        plan.labels = labels.toMutableSet()
        plan.testCases = testCases.toMutableSet()
        plan.updatedBy = CurrentUser.get()
    }

    private fun accessibleProject(projectShortCode: String): WorkspaceProject {
        val project = projectRepository.findByProjectShortCode(projectShortCode)
        requireNotNull(project) { "No project found for id $projectShortCode" }
        projectAccessService.requireAccess(project)
        return project
    }

    private fun accessiblePlan(testPlanID: UUID): TestPlan {
        val plan = testPlanRepository.findByExternalID(testPlanID)
        requireNotNull(plan) { "No test plan found with id $testPlanID" }
        projectAccessService.requireAccess(plan.project)
        return plan
    }
}
