package com.sparkytc.sparkytcservice.repositories

import com.sparkytc.sparkytcservice.models.TestCase
import com.sparkytc.sparkytcservice.models.TestCaseAttachment
import org.springframework.data.jpa.repository.JpaRepository
import java.util.UUID

interface TestCaseAttachmentRepository : JpaRepository<TestCaseAttachment, Long> {
    fun findByExternalID(externalID: UUID): TestCaseAttachment?

    fun findAllByTestCaseOrderByCreationDateAsc(testCase: TestCase): List<TestCaseAttachment>
}
