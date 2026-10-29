package com.sparkytc.sparkytcservice.services

import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.module.kotlin.readValue
import com.sparkytc.sparkytcservice.auth.CurrentUser
import com.sparkytc.sparkytcservice.dto.steps.StepResultDTO
import com.sparkytc.sparkytcservice.dto.testruns.TestCaseRunDraftDTO
import com.sparkytc.sparkytcservice.dto.testruns.TestCaseRunStatus
import com.sparkytc.sparkytcservice.models.TestCaseRun
import com.sparkytc.sparkytcservice.models.TestCaseRunDraft
import com.sparkytc.sparkytcservice.models.User
import com.sparkytc.sparkytcservice.repositories.TestCaseRunDraftRepository
import com.sparkytc.sparkytcservice.repositories.TestCaseRunRepository
import jakarta.transaction.Transactional
import org.springframework.stereotype.Service
import java.util.Date
import java.util.UUID

/**
 * Keeps what each user has marked and written for a test case in a run until they save the result, so leaving
 * the page, closing the browser or switching devices loses nothing. Drafts are personal: nobody else sees them.
 */
@Service
class ResultDraftService(
    private val draftRepository: TestCaseRunDraftRepository,
    private val testCaseRunRepository: TestCaseRunRepository,
    private val projectAccessService: ProjectAccessService,
    private val objectMapper: ObjectMapper,
) {
    @Transactional
    fun retrieveDraft(testCaseRunID: UUID): TestCaseRunDraftDTO? {
        val (testCaseRun, user) = requireTestCaseRun(testCaseRunID)
        val draft = draftRepository.findByTestCaseRunAndUser(testCaseRun, user) ?: return null
        return TestCaseRunDraftDTO(
            status = draft.status,
            notes = draft.notes,
            stepResults = draft.stepResults?.let { objectMapper.readValue<List<StepResultDTO>>(it) }.orEmpty(),
            updatedAt = draft.modifyDate,
        )
    }

    /** Replaces the user's draft; an empty one is removed. */
    @Transactional
    fun saveDraft(testCaseRunID: UUID, request: TestCaseRunDraftDTO): TestCaseRunDraftDTO? {
        val (testCaseRun, user) = requireTestCaseRun(testCaseRunID)
        // only the steps of this test case, and the ones with something in them
        val stepIDs = testCaseRun.steps.map { it.externalID }.toSet()
        val stepResults = request.stepResults
            .filter { it.stepID in stepIDs }
            .map { it.copy(actual = it.actual?.takeIf { actual -> actual.isNotBlank() }) }
            .filter { it.status != null || it.actual != null }
        val status = request.status?.takeIf { it != TestCaseRunStatus.PENDING }
        val notes = request.notes?.takeIf { it.isNotBlank() }

        val existing = draftRepository.findByTestCaseRunAndUser(testCaseRun, user)
        if (status == null && notes == null && stepResults.isEmpty()) {
            existing?.let { draftRepository.delete(it) }
            return null
        }
        val draft = existing ?: TestCaseRunDraft(testCaseRun = testCaseRun, user = user)
        draft.status = status
        draft.notes = notes
        draft.stepResults = objectMapper.writeValueAsString(stepResults)
        draft.modifyDate = Date()
        draftRepository.save(draft)
        return TestCaseRunDraftDTO(status, notes, stepResults, draft.modifyDate)
    }

    @Transactional
    fun discardDraft(testCaseRunID: UUID) {
        val (testCaseRun, user) = requireTestCaseRun(testCaseRunID)
        discard(testCaseRun, user)
    }

    /** Called once the result is saved: the draft became the result. */
    fun discard(testCaseRun: TestCaseRun, user: User?) {
        if (user == null) return
        draftRepository.findByTestCaseRunAndUser(testCaseRun, user)?.let { draftRepository.delete(it) }
    }

    private fun requireTestCaseRun(testCaseRunID: UUID): Pair<TestCaseRun, User> {
        val testCaseRun = testCaseRunRepository.findByExternalID(testCaseRunID)
        requireNotNull(testCaseRun) { "No test case found for id $testCaseRunID" }
        projectAccessService.requireAccess(testCaseRun.testRun.project)
        val user = CurrentUser.get()
        requireNotNull(user) { "Sign in to keep a draft" }
        return testCaseRun to user
    }
}
