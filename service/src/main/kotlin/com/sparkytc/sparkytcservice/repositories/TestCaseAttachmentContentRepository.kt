package com.sparkytc.sparkytcservice.repositories

import com.sparkytc.sparkytcservice.models.TestCaseAttachment
import com.sparkytc.sparkytcservice.models.TestCaseAttachmentContent
import org.springframework.data.jpa.repository.JpaRepository

interface TestCaseAttachmentContentRepository : JpaRepository<TestCaseAttachmentContent, Long> {
    fun findByAttachment(attachment: TestCaseAttachment): TestCaseAttachmentContent?

    fun deleteAllByAttachment(attachment: TestCaseAttachment)
}
