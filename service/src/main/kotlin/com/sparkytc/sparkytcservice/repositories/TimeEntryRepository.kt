package com.sparkytc.sparkytcservice.repositories

import com.sparkytc.sparkytcservice.models.TestCaseRun
import com.sparkytc.sparkytcservice.models.TestRun
import com.sparkytc.sparkytcservice.models.TimeEntry
import com.sparkytc.sparkytcservice.models.User
import org.springframework.data.jpa.repository.JpaRepository

interface TimeEntryRepository : JpaRepository<TimeEntry, Long> {
    fun findAllByTestCaseRunTestRunOrderByStartedAtAsc(testRun: TestRun): List<TimeEntry>

    fun findAllByTestCaseRunTestRunIn(testRuns: Collection<TestRun>): List<TimeEntry>

    fun findAllByTestCaseRun(testCaseRun: TestCaseRun): List<TimeEntry>

    fun findAllByUserAndEndedAtIsNull(user: User): List<TimeEntry>

    fun findAllByTestCaseRunAndEndedAtIsNull(testCaseRun: TestCaseRun): List<TimeEntry>

    fun existsByTestCaseRun(testCaseRun: TestCaseRun): Boolean
}
