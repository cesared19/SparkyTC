package com.sparkytc.sparkytcservice.repositories

import com.sparkytc.sparkytcservice.models.TestCase
import com.sparkytc.sparkytcservice.models.TestCaseRun
import com.sparkytc.sparkytcservice.models.TestRun
import org.springframework.data.jpa.repository.JpaRepository
import java.util.UUID

interface TestCaseRunRepository : JpaRepository<TestCaseRun, Long> {
    fun findByExternalID(externalID: UUID): TestCaseRun?

    fun findAllByTestRun(testRun: TestRun): List<TestCaseRun>

    fun findAllByTestRunIn(testRuns: Collection<TestRun>): List<TestCaseRun>

    fun existsByTestCase(testCase: TestCase): Boolean

    fun findAllByTestRunOrderByTestCaseTestCaseNumberAsc(testRun: TestRun): List<TestCaseRun>

    fun deleteAllByTestRun(testRun: TestRun)

    fun deleteByExternalID(externalID: UUID)
}