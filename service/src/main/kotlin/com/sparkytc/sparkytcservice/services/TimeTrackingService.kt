package com.sparkytc.sparkytcservice.services

import com.sparkytc.sparkytcservice.auth.CurrentUser
import com.sparkytc.sparkytcservice.dto.auth.UserRole
import com.sparkytc.sparkytcservice.dto.testruns.TestCaseRunDTO
import com.sparkytc.sparkytcservice.dto.time.RunningTimerDTO
import com.sparkytc.sparkytcservice.dto.time.TestRunTimeDTO
import com.sparkytc.sparkytcservice.dto.time.TimeEntryDTO
import com.sparkytc.sparkytcservice.dto.time.UpdateTestRunTimeDTO
import com.sparkytc.sparkytcservice.models.TestCaseRun
import com.sparkytc.sparkytcservice.models.TestRun
import com.sparkytc.sparkytcservice.models.TimeEntry
import com.sparkytc.sparkytcservice.models.User
import com.sparkytc.sparkytcservice.repositories.TestCaseRunRepository
import com.sparkytc.sparkytcservice.repositories.TestRunRepository
import com.sparkytc.sparkytcservice.repositories.TimeEntryRepository
import jakarta.transaction.Transactional
import org.springframework.stereotype.Service
import java.util.Date
import java.util.UUID

/**
 * Time testers spend on the test cases of runs that track time. Each user has at most one running timer;
 * starting another one pauses it, and recording a test case's result stops its timers.
 */
@Service
class TimeTrackingService(
    private val timeEntryRepository: TimeEntryRepository,
    private val testCaseRunRepository: TestCaseRunRepository,
    private val testRunRepository: TestRunRepository,
    private val projectAccessService: ProjectAccessService,
) {
    @Transactional
    fun startTimer(testCaseRunID: UUID): TestCaseRunDTO {
        val testCaseRun = trackedTestCaseRun(testCaseRunID)
        val actor = requireNotNull(CurrentUser.get()) { "Not signed in" }
        val assignee = testCaseRun.assignedTo
        require(assignee == null || assignee.id == actor.id || actor.role == UserRole.ADMIN) {
            "This test case is assigned to ${assignee?.displayName}"
        }

        val now = Date()
        val running = timeEntryRepository.findAllByUserAndEndedAtIsNull(actor)
        if (running.none { it.testCaseRun.id == testCaseRun.id }) {
            // only one timer runs per user, the one on another test case is paused
            running.forEach { stop(it, now) }
            timeEntryRepository.save(TimeEntry(testCaseRun = testCaseRun, user = actor, startedAt = now))
        }
        if (testCaseRun.assignedTo == null) {
            testCaseRun.assignedTo = actor
            testCaseRunRepository.save(testCaseRun)
        }
        return reloaded(testCaseRun)
    }

    @Transactional
    fun pauseTimer(testCaseRunID: UUID): TestCaseRunDTO {
        val testCaseRun = trackedTestCaseRun(testCaseRunID)
        val actor = requireNotNull(CurrentUser.get()) { "Not signed in" }
        val now = Date()
        timeEntryRepository.findAllByTestCaseRunAndEndedAtIsNull(testCaseRun)
            .filter { it.user?.id == actor.id }
            .forEach { stop(it, now) }
        return reloaded(testCaseRun)
    }

    /**
     * Called when a result is recorded: stops the test case's timers, and keeps the time typed in when
     * the timer wasn't used.
     */
    fun resultRecorded(testCaseRun: TestCaseRun, actor: User?, manualSeconds: Long?) {
        if (!testCaseRun.testRun.trackTime) return
        val now = Date()
        timeEntryRepository.findAllByTestCaseRunAndEndedAtIsNull(testCaseRun).forEach { stop(it, now) }

        if (manualSeconds != null && manualSeconds > 0 && !timeEntryRepository.existsByTestCaseRun(testCaseRun)) {
            require(manualSeconds <= MAX_MANUAL_SECONDS) { "The time spent must be less than 24 hours" }
            timeEntryRepository.save(TimeEntry(
                testCaseRun = testCaseRun,
                user = actor,
                startedAt = Date(now.time - manualSeconds * 1000),
                endedAt = now,
                isManual = true,
            ))
        }
    }

    @Transactional
    fun retrieveTestRunTime(testRunID: UUID): TestRunTimeDTO {
        val testRun = testRun(testRunID)
        val now = Date()
        val entries = timeEntryRepository.findAllByTestCaseRunTestRunOrderByStartedAtAsc(testRun)
        val tracked = entries.sumOf { it.seconds(now) }
        return TestRunTimeDTO(
            trackTime = testRun.trackTime,
            trackedSeconds = tracked,
            overrideSeconds = testRun.timeOverrideSeconds,
            totalSeconds = testRun.timeOverrideSeconds ?: tracked,
            entries = entries.map { entry ->
                TimeEntryDTO(
                    timeEntryID = entry.externalID,
                    testCaseRunID = entry.testCaseRun.externalID,
                    testCaseNumber = entry.testCaseRun.testCase.testCaseNumber,
                    testCaseTitle = entry.testCaseRun.title,
                    user = entry.user?.displayName,
                    startedAt = entry.startedAt,
                    endedAt = entry.endedAt,
                    seconds = entry.seconds(now),
                    isManual = entry.isManual,
                )
            },
        )
    }

    /** Admins set the total of a closed test run, replacing the tracked time, or go back to it with null. */
    @Transactional
    fun updateTestRunTime(testRunID: UUID, request: UpdateTestRunTimeDTO): TestRunTimeDTO {
        val testRun = testRun(testRunID)
        require(testRun.trackTime) { "This test run doesn't track time" }
        require(testRun.isClosed) { "The total can only be changed once the test run is complete or aborted" }
        val total = request.totalSeconds
        require(total == null || total in 0..MAX_TOTAL_SECONDS) { "The total must be between 0 and 10,000 hours" }
        testRun.timeOverrideSeconds = total
        testRunRepository.save(testRun)
        return retrieveTestRunTime(testRunID)
    }

    /** Total time of each test run that tracks time, the admin's total when set. */
    fun totals(testRuns: Collection<TestRun>): Map<Long, Long> {
        val tracked = testRuns.filter { it.trackTime }
        if (tracked.isEmpty()) return emptyMap()
        val now = Date()
        val seconds = timeEntryRepository.findAllByTestCaseRunTestRunIn(tracked)
            .groupBy { it.testCaseRun.testRun.id }
            .mapValues { (_, entries) -> entries.sumOf { it.seconds(now) } }
        return tracked.associate { it.id to (it.timeOverrideSeconds ?: seconds[it.id] ?: 0) }
    }

    private fun stop(entry: TimeEntry, now: Date) {
        entry.endedAt = now
        timeEntryRepository.save(entry)
    }

    private fun trackedTestCaseRun(testCaseRunID: UUID): TestCaseRun {
        val testCaseRun = testCaseRunRepository.findByExternalID(testCaseRunID)
        requireNotNull(testCaseRun) { "No test case found for id $testCaseRunID" }
        projectAccessService.requireAccess(testCaseRun.testRun.project)
        require(testCaseRun.testRun.trackTime) { "This test run doesn't track time" }
        require(!testCaseRun.testRun.isClosed) { "Time can't be tracked once the test run is closed" }
        return testCaseRun
    }

    private fun testRun(testRunID: UUID): TestRun {
        val testRun = testRunRepository.findByExternalID(testRunID)
        requireNotNull(testRun) { "No test run found for id $testRunID" }
        projectAccessService.requireAccess(testRun.project)
        return testRun
    }

    private fun reloaded(testCaseRun: TestCaseRun): TestCaseRunDTO {
        timeEntryRepository.flush()
        val dto = testCaseRun.toDTO()
        val now = Date()
        // the entity's collection was loaded before this change
        val entries = timeEntryRepository.findAllByTestCaseRun(testCaseRun)
        return dto.copy(
            timeSeconds = entries.sumOf { it.seconds(now) },
            runningTimers = entries.filter { it.isRunning }.map {
                RunningTimerDTO(it.user?.externalID, it.user?.displayName, it.startedAt)
            },
        )
    }

    companion object {
        const val MAX_MANUAL_SECONDS = 24L * 60 * 60
        const val MAX_TOTAL_SECONDS = 10_000L * 60 * 60
    }
}
