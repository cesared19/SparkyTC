package com.sparkytc.sparkytcservice.services

import com.sparkytc.sparkytcservice.auth.CurrentUser
import com.sparkytc.sparkytcservice.dto.attachments.TestCaseAttachmentDTO
import com.sparkytc.sparkytcservice.dto.auth.UserRole
import com.sparkytc.sparkytcservice.dto.testruns.TestCaseHistoryEntryDTO
import com.sparkytc.sparkytcservice.dto.testruns.TestCaseRunStatus
import com.sparkytc.sparkytcservice.dto.testruns.TestRunStatus
import com.sparkytc.sparkytcservice.models.TestCaseAttachment
import com.sparkytc.sparkytcservice.models.TestCaseResult
import com.sparkytc.sparkytcservice.models.TestCaseRun
import com.sparkytc.sparkytcservice.models.User
import com.sparkytc.sparkytcservice.repositories.TestCaseRepository
import com.sparkytc.sparkytcservice.repositories.TestCaseResultRepository
import com.sparkytc.sparkytcservice.repositories.TestCaseRunRepository
import com.sparkytc.sparkytcservice.repositories.TestRunRepository
import jakarta.transaction.Transactional
import org.springframework.stereotype.Service
import org.springframework.web.multipart.MultipartFile
import java.util.Date
import java.util.UUID

/**
 * The results recorded for test cases in test runs. Each recording adds a result with its comment and evidence;
 * the test case run keeps a copy of the latest one as its status, which the rest of the app reads.
 */
@Service
class TestCaseResultService(
    private val testCaseResultRepository: TestCaseResultRepository,
    private val testCaseRunRepository: TestCaseRunRepository,
    private val testRunRepository: TestRunRepository,
    private val testCaseRepository: TestCaseRepository,
    private val projectAccessService: ProjectAccessService,
    private val attachmentService: AttachmentService,
) {
    /** Adds a result and makes it the test case's status in the run. */
    fun record(testCaseRun: TestCaseRun, status: TestCaseRunStatus, notes: String?, actor: User?): TestCaseResult {
        require(status != TestCaseRunStatus.PENDING) { "Choose a result: pass, fail, blocked or skip" }
        val result = testCaseResultRepository.save(TestCaseResult(
            testCaseRun = testCaseRun,
            status = status,
            notes = notes?.trim()?.takeIf { it.isNotEmpty() },
            recordedBy = actor,
            recordedAt = Date(),
        ))
        applyLatest(testCaseRun, result)
        return result
    }

    /** Admins delete a result recorded by mistake; the test case goes back to its previous result, or pending. */
    @Transactional
    fun deleteResult(resultID: UUID) {
        val result = accessibleResult(resultID)
        val testCaseRun = result.testCaseRun
        testCaseResultRepository.delete(result)
        testCaseResultRepository.flush()

        applyLatest(testCaseRun, testCaseResultRepository.findAllByTestCaseRunOrderByRecordedAtAscIdAsc(testCaseRun).lastOrNull())

        // a complete run opens again when a test case is left without a final result
        val testRun = testCaseRun.testRun
        val isDone = testCaseRunRepository.findAllByTestRun(testRun)
            .all { it.status != TestCaseRunStatus.PENDING && it.status != TestCaseRunStatus.BLOCKED }
        if (!isDone && testRun.status == TestRunStatus.COMPLETE) {
            testRun.status = TestRunStatus.IN_PROGRESS
            testRunRepository.save(testRun)
        }
    }

    /** Evidence is added by whoever recorded the result, or an admin. */
    @Transactional
    fun uploadEvidence(resultID: UUID, files: List<MultipartFile>): List<TestCaseAttachmentDTO> {
        val result = accessibleResult(resultID)
        requireAuthorOrAdmin(result, "Only who recorded this result or an admin can add evidence to it")
        return attachmentService.store(result.testCaseRun.testCase, files, result)
    }

    /** Throws unless the current user can remove this piece of evidence. */
    fun requireCanDeleteEvidence(attachment: TestCaseAttachment) {
        val result = attachment.testCaseResult ?: return
        requireAuthorOrAdmin(result, "Only who recorded this result or an admin can remove its evidence")
    }

    /** Every result of a test case in the runs of its project, newest first. */
    @Transactional
    fun retrieveHistory(testCaseID: UUID): List<TestCaseHistoryEntryDTO> {
        val testCase = testCaseRepository.findByExternalID(testCaseID)
        requireNotNull(testCase) { "No test case found with id $testCaseID" }
        projectAccessService.requireAccess(testCase.project)

        val results = testCaseResultRepository.findAllByTestCaseRunTestCaseOrderByRecordedAtDescIdDesc(testCase)
        val latestByRun = results.groupBy { it.testCaseRun.id }.mapValues { (_, runResults) -> runResults.first().id }
        return results.map { result ->
            val testRun = result.testCaseRun.testRun
            TestCaseHistoryEntryDTO(
                result = result.toDTO(),
                testRunID = testRun.externalID,
                testRunNumber = testRun.testRunNumber,
                testRunTitle = testRun.title,
                buildNumber = testRun.build?.buildNumber,
                isLatestInRun = latestByRun[result.testCaseRun.id] == result.id,
                testRunCreationDate = testRun.creationDate,
            )
        }
    }

    private fun applyLatest(testCaseRun: TestCaseRun, latest: TestCaseResult?) {
        testCaseRun.status = latest?.status ?: TestCaseRunStatus.PENDING
        testCaseRun.notes = latest?.notes
        testCaseRun.executedBy = latest?.recordedBy
        testCaseRun.executedAt = latest?.recordedAt
        testCaseRunRepository.save(testCaseRun)
    }

    private fun accessibleResult(resultID: UUID): TestCaseResult {
        val result = testCaseResultRepository.findByExternalID(resultID)
        requireNotNull(result) { "No result found with id $resultID" }
        projectAccessService.requireAccess(result.testCaseRun.testRun.project)
        return result
    }

    private fun requireAuthorOrAdmin(result: TestCaseResult, message: String) {
        val actor = CurrentUser.get()
        require(actor != null && (actor.role == UserRole.ADMIN || result.recordedBy?.id == actor.id)) { message }
    }
}
