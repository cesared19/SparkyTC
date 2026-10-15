package com.cherry.cherryservice.repositories

import com.cherry.cherryservice.models.TestCase
import com.cherry.cherryservice.models.TestCaseJiraLink
import org.springframework.data.jpa.repository.JpaRepository
import java.util.UUID

interface TestCaseJiraLinkRepository : JpaRepository<TestCaseJiraLink, Long> {
    fun findByExternalID(externalID: UUID): TestCaseJiraLink?

    fun findByTestCaseAndIssueKey(testCase: TestCase, issueKey: String): TestCaseJiraLink?
}
