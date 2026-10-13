package com.cherry.cherryservice.repositories

import com.cherry.cherryservice.models.TestCase
import com.cherry.cherryservice.models.TestCaseAttachment
import org.springframework.data.jpa.repository.JpaRepository
import java.util.UUID

interface TestCaseAttachmentRepository : JpaRepository<TestCaseAttachment, Long> {
    fun findByExternalID(externalID: UUID): TestCaseAttachment?

    fun findAllByTestCaseOrderByCreationDateAsc(testCase: TestCase): List<TestCaseAttachment>
}
