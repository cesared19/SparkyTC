package com.sparkytc.sparkytcservice.repositories

import com.sparkytc.sparkytcservice.models.TestCase
import com.sparkytc.sparkytcservice.models.TestCaseJiraLink
import com.sparkytc.sparkytcservice.models.TestCaseRun
import org.springframework.data.jpa.repository.JpaRepository
import java.util.UUID

interface TestCaseJiraLinkRepository : JpaRepository<TestCaseJiraLink, Long> {
    fun findByExternalID(externalID: UUID): TestCaseJiraLink?

    fun findByTestCaseAndIssueKey(testCase: TestCase, issueKey: String): TestCaseJiraLink?

    fun findAllByIssueKeyIn(issueKeys: List<String>): List<TestCaseJiraLink>

    fun existsByTestCaseRun(testCaseRun: TestCaseRun): Boolean
}
