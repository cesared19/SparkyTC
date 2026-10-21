package com.sparkytc.sparkytcservice.repositories

import com.sparkytc.sparkytcservice.models.TestCase
import com.sparkytc.sparkytcservice.models.TestCaseResult
import com.sparkytc.sparkytcservice.models.TestCaseRun
import org.springframework.data.jpa.repository.JpaRepository
import java.util.UUID

interface TestCaseResultRepository : JpaRepository<TestCaseResult, Long> {
    fun findByExternalID(externalID: UUID): TestCaseResult?

    fun findAllByTestCaseRunOrderByRecordedAtAscIdAsc(testCaseRun: TestCaseRun): List<TestCaseResult>

    fun findAllByTestCaseRunTestCaseOrderByRecordedAtDescIdDesc(testCase: TestCase): List<TestCaseResult>
}
