package com.sparkytc.sparkytcservice.services

import com.sparkytc.sparkytcservice.auth.CurrentUser
import com.sparkytc.sparkytcservice.dto.bulk.BulkAssignTestCaseRunsDTO
import com.sparkytc.sparkytcservice.dto.bulk.BulkDeleteTestCasesDTO
import com.sparkytc.sparkytcservice.dto.bulk.BulkEditResultDTO
import com.sparkytc.sparkytcservice.dto.bulk.BulkEditTestCasesDTO
import com.sparkytc.sparkytcservice.dto.testruns.UpdateTestCaseRunAssigneeDTO
import com.sparkytc.sparkytcservice.models.TestCase
import com.sparkytc.sparkytcservice.repositories.PropertyConfigurationRepository
import com.sparkytc.sparkytcservice.repositories.TestCasePropertyValueRepository
import com.sparkytc.sparkytcservice.repositories.TestCaseRepository
import com.sparkytc.sparkytcservice.repositories.TestCaseRunRepository
import jakarta.transaction.Transactional
import org.springframework.stereotype.Service
import java.util.UUID

/**
 * Changes applied to many test cases, or test cases of a run, at once. Each request is all or nothing: if one
 * test case can't be changed, none is.
 */
@Service
class BulkEditService(
    private val testCaseRepository: TestCaseRepository,
    private val testCaseRunRepository: TestCaseRunRepository,
    private val propertyConfigurationRepository: PropertyConfigurationRepository,
    private val propertyValueRepository: TestCasePropertyValueRepository,
    private val projectAccessService: ProjectAccessService,
    private val sectionService: TestCaseSectionService,
    private val stepService: StepService,
    private val workspaceService: WorkspaceService,
) {
    @Transactional
    fun editTestCases(request: BulkEditTestCasesDTO): BulkEditResultDTO {
        val testCases = requireTestCases(request.testCaseIDs)
        val project = testCases.first().project
        val section = request.sectionID?.let { sectionService.sectionFor(project, it) }
        val property = request.propertyID?.let { propertyID ->
            propertyConfigurationRepository.findAll().firstOrNull { it.externalID == propertyID }
                ?: throw IllegalArgumentException("No property found with id $propertyID")
        }
        val removed = request.removeLabels.map { it.trim().lowercase() }.toSet()
        require(section != null || request.addLabels.isNotEmpty() || removed.isNotEmpty() || property != null || request.format != null) {
            "Choose what to change"
        }

        for (testCase in testCases) {
            section?.let { testCase.section = it }
            if (request.addLabels.isNotEmpty() || removed.isNotEmpty()) {
                val kept = testCase.labels.filter { it.lowercase() !in removed }
                testCase.labels = workspaceService.cleanLabels(kept + request.addLabels)
            }
            request.format?.let { stepService.convertFormat(testCase, it) }
            testCase.updatedBy = CurrentUser.get()
            testCaseRepository.save(testCase)

            if (property != null) {
                // the other properties keep their values
                val values = testCase.propertyValues.associate { it.propertyConfiguration.externalID to it.value }.toMutableMap()
                val value = request.propertyValue?.trim()
                if (value.isNullOrEmpty()) values.remove(property.externalID) else values[property.externalID] = value
                propertyValueRepository.deleteAll(testCase.propertyValues)
                propertyValueRepository.flush()
                try {
                    workspaceService.updateTestCasePropertyValues(testCase, values)
                } catch (e: IllegalArgumentException) {
                    throw IllegalArgumentException("${testCase.project.projectShortCode}-${testCase.testCaseNumber}: ${e.message}", e)
                }
            }
        }
        return BulkEditResultDTO(updated = testCases.size)
    }

    /** Deletes test cases, archiving the ones test runs use so the runs keep their results. */
    @Transactional
    fun deleteTestCases(request: BulkDeleteTestCasesDTO): BulkEditResultDTO {
        val testCases = requireTestCases(request.testCaseIDs)
        val used = testCases.count { testCaseRunRepository.existsByTestCase(it) }
        testCases.forEach { workspaceService.deleteTestCase(it.externalID) }
        return BulkEditResultDTO(archived = used, deleted = testCases.size - used)
    }

    /** Assigns test cases of a run, with the same rules as one at a time; the ones already there are left as they are. */
    @Transactional
    fun assignTestCaseRuns(request: BulkAssignTestCaseRunsDTO): BulkEditResultDTO {
        require(request.testCaseRunIDs.isNotEmpty()) { "Choose the test cases to assign" }
        var updated = 0
        for (testCaseRunID in request.testCaseRunIDs.distinct()) {
            val testCaseRun = testCaseRunRepository.findByExternalID(testCaseRunID)
            requireNotNull(testCaseRun) { "No test case found for id $testCaseRunID" }
            if (testCaseRun.assignedTo?.externalID == request.userID) continue
            try {
                workspaceService.updateTestCaseRunAssignee(testCaseRunID, UpdateTestCaseRunAssigneeDTO(request.userID))
            } catch (e: IllegalArgumentException) {
                throw IllegalArgumentException("${testCaseRun.title}: ${e.message}", e)
            }
            updated++
        }
        return BulkEditResultDTO(updated = updated)
    }

    private fun requireTestCases(testCaseIDs: List<UUID>): List<TestCase> {
        require(testCaseIDs.isNotEmpty()) { "Choose the test cases to change" }
        val testCases = testCaseIDs.distinct().map { testCaseID ->
            val testCase = testCaseRepository.findByExternalID(testCaseID)
            require(testCase != null && !testCase.isArchived) { "No test case found with id $testCaseID" }
            testCase
        }
        val project = testCases.first().project
        require(testCases.all { it.project.id == project.id }) { "The test cases must belong to the same project" }
        projectAccessService.requireAccess(project)
        return testCases
    }
}
