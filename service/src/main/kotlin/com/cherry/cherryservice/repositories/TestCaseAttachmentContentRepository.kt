package com.cherry.cherryservice.repositories

import com.cherry.cherryservice.models.TestCaseAttachment
import com.cherry.cherryservice.models.TestCaseAttachmentContent
import org.springframework.data.jpa.repository.JpaRepository

interface TestCaseAttachmentContentRepository : JpaRepository<TestCaseAttachmentContent, Long> {
    fun findByAttachment(attachment: TestCaseAttachment): TestCaseAttachmentContent?

    fun deleteAllByAttachment(attachment: TestCaseAttachment)
}
