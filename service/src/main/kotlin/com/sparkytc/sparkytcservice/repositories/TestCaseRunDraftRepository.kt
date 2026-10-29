package com.sparkytc.sparkytcservice.repositories

import com.sparkytc.sparkytcservice.models.TestCaseRun
import com.sparkytc.sparkytcservice.models.TestCaseRunDraft
import com.sparkytc.sparkytcservice.models.User
import org.springframework.data.jpa.repository.JpaRepository

interface TestCaseRunDraftRepository : JpaRepository<TestCaseRunDraft, Long> {
    fun findByTestCaseRunAndUser(testCaseRun: TestCaseRun, user: User): TestCaseRunDraft?
}
